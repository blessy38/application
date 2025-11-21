import { ObjectId } from "mongodb";
import { getDB } from "../config/database.js";

export const USERS_COLLECTION = "users";
export const DEFAULT_PROFILE_PHOTO = "/uploads/default-avatar.png";

const TRUVEDA_PATTERN = /^[a-zA-Z0-9_]+$/;
const EMAIL_PATTERN =
  /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
const MAX_FIRST_NAME = 50;
const MAX_LAST_NAME = 50;
const MAX_DISPLAY_NAME = 100;
const MAX_INTRO = 200;
const MAX_ABOUT = 2000;
const DEFAULT_SOCIAL_LINKS = {
  instagramLink: "",
  facebookLink: "",
  youtubeLink: "",
  linkedinLink: "",
};

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
  }
}

const toObjectId = (id) => {
  const value =
    typeof id === "string" ? id.trim() : id?.toString()?.trim() ?? "";
  if (!value || !ObjectId.isValid(value)) {
    throw new ValidationError("Invalid user id");
  }
  return new ObjectId(value);
};

const coerceBoolean = (value, defaultValue = true) => {
  if (value === undefined) return defaultValue;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.toLowerCase();
    if (["true", "1", "yes"].includes(normalized)) return true;
    if (["false", "0", "no"].includes(normalized)) return false;
  }
  throw new ValidationError("isActive must be a boolean value");
};

const sanitizeString = (value, { trim = true, lowercase = false } = {}) => {
  if (value === undefined || value === null) return undefined;
  let result = typeof value === "string" ? value : String(value);
  if (trim) result = result.trim();
  if (!result.length) return "";
  if (lowercase) result = result.toLowerCase();
  return result;
};

const validateLength = (value, max, field, errors) => {
  if (value && value.length > max) {
    errors.push(`${field} must be at most ${max} characters`);
  }
};

const validatePattern = (value, pattern, message, errors) => {
  if (value && !pattern.test(value)) {
    errors.push(message);
  }
};

const buildSocialLinks = (input = {}, { partial = false } = {}) => {
  if (!input && partial) {
    return undefined;
  }

  const links = partial ? {} : { ...DEFAULT_SOCIAL_LINKS };
  Object.keys(DEFAULT_SOCIAL_LINKS).forEach((key) => {
    if (input[key] === undefined) {
      if (!partial) {
        links[key] = DEFAULT_SOCIAL_LINKS[key];
      }
      return;
    }
    links[key] = sanitizeString(input[key]) ?? DEFAULT_SOCIAL_LINKS[key];
  });
  return Object.keys(links).length ? links : undefined;
};

const applyVirtuals = (doc) => {
  if (!doc) return null;
  const firstName = doc.firstName ?? "";
  const lastName = doc.lastName ?? "";
  return {
    ...doc,
    fullName: [firstName, lastName].filter(Boolean).join(" ").trim(),
  };
};

const prepareUserDoc = (payload, { partial = false } = {}) => {
  const errors = [];
  const doc = {};

  const assignStringField = (field, options) => {
    const value = sanitizeString(payload[field], options);
    if (!value && !partial) {
      if (options.required) {
        errors.push(`${field} is required`);
      } else if (options.default !== undefined) {
        doc[field] =
          typeof options.default === "function"
            ? options.default()
            : options.default;
      }
      return;
    }

    if (value) {
      if (options.maxLength) {
        validateLength(value, options.maxLength, field, errors);
      }
      if (options.pattern) {
        validatePattern(value, options.pattern, options.patternMessage, errors);
      }
      doc[field] = value;
    } else if (options.default !== undefined && !partial) {
      doc[field] =
        typeof options.default === "function"
          ? options.default()
          : options.default;
    } else if (!value && options.required && !partial) {
      errors.push(`${field} is required`);
    }
  };

  assignStringField("profilePhoto", {
    default: DEFAULT_PROFILE_PHOTO,
    trim: true,
  });
  assignStringField("truvedaLink", {
    required: true,
    trim: true,
    lowercase: true,
    pattern: TRUVEDA_PATTERN,
    patternMessage: "truvedaLink may only contain letters, numbers, underscores",
  });
  assignStringField("firstName", {
    required: true,
    trim: true,
    maxLength: MAX_FIRST_NAME,
  });
  assignStringField("lastName", {
    required: true,
    trim: true,
    maxLength: MAX_LAST_NAME,
  });
  assignStringField("displayName", {
    required: true,
    trim: true,
    maxLength: MAX_DISPLAY_NAME,
  });
  assignStringField("intro", {
    trim: true,
    maxLength: MAX_INTRO,
    default: "",
  });
  assignStringField("aboutYourself", {
    trim: true,
    maxLength: MAX_ABOUT,
    default: "",
  });
  assignStringField("email", {
    required: true,
    trim: true,
    lowercase: true,
    pattern: EMAIL_PATTERN,
    patternMessage: "Please provide a valid email",
  });

  const socialLinks = buildSocialLinks(payload.socialLinks, { partial });
  if (socialLinks) {
    doc.socialLinks = socialLinks;
  } else if (!partial) {
    doc.socialLinks = { ...DEFAULT_SOCIAL_LINKS };
  }

  if (payload.isActive !== undefined || !partial) {
    doc.isActive = coerceBoolean(payload.isActive, true);
  }

  if (errors.length) {
    throw new ValidationError(errors.join(", "));
  }

  return doc;
};

export const ensureUserIndexes = async () => {
  const db = getDB();
  await db.collection(USERS_COLLECTION).createIndexes([
    { key: { email: 1 }, unique: true, name: "unique_email" },
    { key: { truvedaLink: 1 }, unique: true, name: "unique_truvedaLink" },
  ]);
};

export const createUser = async (data) => {
  const db = getDB();
  const now = new Date();
  const doc = {
    ...prepareUserDoc(data),
    createdAt: now,
    updatedAt: now,
  };

  const result = await db.collection(USERS_COLLECTION).insertOne(doc);
  return applyVirtuals({ ...doc, _id: result.insertedId });
};

export const listUsers = async ({ page = 1, limit = 10, search = "" } = {}) => {
  const db = getDB();
  const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
  const limitNumber = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
  const skip = (pageNumber - 1) * limitNumber;
  const query = {};

  if (search && search.trim()) {
    const regex = new RegExp(search.trim(), "i");
    query.$or = [
      { firstName: regex },
      { lastName: regex },
      { displayName: regex },
      { email: regex },
      { truvedaLink: regex },
    ];
  }

  const collection = db.collection(USERS_COLLECTION);
  const [records, total] = await Promise.all([
    collection
      .find(query)
      .skip(skip)
      .limit(limitNumber)
      .sort({ createdAt: -1 })
      .toArray(),
    collection.countDocuments(query),
  ]);

  return {
    data: records.map(applyVirtuals),
    total,
    totalPages: total ? Math.ceil(total / limitNumber) : 0,
    page: pageNumber,
    limit: limitNumber,
  };
};

export const findUserById = async (id) => {
  const db = getDB();
  const user = await db
    .collection(USERS_COLLECTION)
    .findOne({ _id: toObjectId(id) });
  return applyVirtuals(user);
};

export const findUserByEmail = async (email) => {
  const normalized = sanitizeString(email, { trim: true, lowercase: true });
  if (!normalized) return null;
  const db = getDB();
  const user = await db
    .collection(USERS_COLLECTION)
    .findOne({ email: normalized });
  return applyVirtuals(user);
};

export const findUserByTruvedaLink = async (link) => {
  const normalized = sanitizeString(link, { trim: true, lowercase: true });
  if (!normalized) return null;
  const db = getDB();
  const user = await db
    .collection(USERS_COLLECTION)
    .findOne({ truvedaLink: normalized });
  return applyVirtuals(user);
};

export const updateUser = async (id, data) => {
  const db = getDB();
  const updates = prepareUserDoc(data, { partial: true });

  if (!Object.keys(updates).length) {
    throw new ValidationError("At least one field must be provided to update");
  }

  updates.updatedAt = new Date();

  const result = await db.collection(USERS_COLLECTION).findOneAndUpdate(
    { _id: toObjectId(id) },
    { $set: updates },
    { returnDocument: "after" }
  );

  return applyVirtuals(result);
};

export const deleteUser = async (id) => {
  const db = getDB();
  const objectId = toObjectId(id);
  const result = await db.collection(USERS_COLLECTION).findOneAndDelete({ _id: objectId });
  if (!result) {
    throw new ValidationError("User not found");
  }
  return applyVirtuals(result);
};


