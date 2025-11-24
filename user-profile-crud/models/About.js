import { ObjectId } from "mongodb";
import { getDB } from "../config/database.js";

export const ABOUT_COLLECTION = "about";

const MAX_DESCRIPTION = 5000; // Approx 1000 words
const MAX_IMAGES = 4;

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
        throw new ValidationError("Invalid about id");
    }
    return new ObjectId(value);
};

const sanitizeString = (value, { trim = true } = {}) => {
    if (value === undefined || value === null) return undefined;
    let result = typeof value === "string" ? value : String(value);
    if (trim) result = result.trim();
    if (!result.length) return "";
    return result;
};

const validateLength = (value, max, field, errors) => {
    if (value && value.length > max) {
        errors.push(`${field} must be at most ${max} characters`);
    }
};

const prepareAboutDoc = (payload, { partial = false } = {}) => {
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

    assignStringField("description", {
        required: true,
        trim: true,
        maxLength: MAX_DESCRIPTION,
    });

    // Images are handled separately in the controller, but we validate the array here if passed
    if (payload.images) {
        if (!Array.isArray(payload.images)) {
            errors.push("images must be an array");
        } else if (payload.images.length > MAX_IMAGES) {
            errors.push(`You can upload up to ${MAX_IMAGES} images`);
        } else {
            doc.images = payload.images;
        }
    } else if (!partial) {
        doc.images = [];
    }

    if (errors.length) {
        throw new ValidationError(errors.join(", "));
    }

    return doc;
};

export const createAbout = async (data) => {
    const db = getDB();
    const now = new Date();
    const doc = {
        ...prepareAboutDoc(data),
        createdAt: now,
        updatedAt: now,
    };

    const result = await db.collection(ABOUT_COLLECTION).insertOne(doc);
    return { ...doc, _id: result.insertedId };
};

export const listAbouts = async ({ page = 1, limit = 10 } = {}) => {
    const db = getDB();
    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const limitNumber = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const skip = (pageNumber - 1) * limitNumber;

    const collection = db.collection(ABOUT_COLLECTION);
    const [records, total] = await Promise.all([
        collection
            .find({})
            .skip(skip)
            .limit(limitNumber)
            .sort({ createdAt: -1 })
            .toArray(),
        collection.countDocuments({}),
    ]);

    return {
        data: records,
        total,
        totalPages: total ? Math.ceil(total / limitNumber) : 0,
        page: pageNumber,
        limit: limitNumber,
    };
};

export const findAboutById = async (id) => {
    const db = getDB();
    return await db
        .collection(ABOUT_COLLECTION)
        .findOne({ _id: toObjectId(id) });
};

export const updateAbout = async (id, data) => {
    const db = getDB();
    const updates = prepareAboutDoc(data, { partial: true });

    if (!Object.keys(updates).length) {
        throw new ValidationError("At least one field must be provided to update");
    }

    updates.updatedAt = new Date();

    const result = await db.collection(ABOUT_COLLECTION).findOneAndUpdate(
        { _id: toObjectId(id) },
        { $set: updates },
        { returnDocument: "after" }
    );

    return result;
};

export const deleteAbout = async (id) => {
    const db = getDB();
    const objectId = toObjectId(id);
    const result = await db.collection(ABOUT_COLLECTION).findOneAndDelete({ _id: objectId });
    if (!result) {
        throw new ValidationError("About entry not found");
    }
    return result;
};
