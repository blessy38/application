import { ObjectId } from "mongodb";
import { getDB } from "../config/database.js";

export const WORKSHOPS_COLLECTION = "workshops";
export const DEFAULT_WORKSHOP_PHOTO = "/uploads/default-workshop.png";

const MAX_WORKSHOP_NAME = 100;
const MAX_SHORT_DESC = 200;
const MAX_CONTENT = 5000;

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
        throw new ValidationError("Invalid workshop id");
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

const prepareWorkshopDoc = (payload, { partial = false } = {}) => {
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

    assignStringField("workshopPhoto", {
        default: DEFAULT_WORKSHOP_PHOTO,
        trim: true,
    });
    assignStringField("workshopName", {
        required: true,
        trim: true,
        maxLength: MAX_WORKSHOP_NAME,
    });
    assignStringField("shortDescription", {
        required: true,
        trim: true,
        maxLength: MAX_SHORT_DESC,
    });
    assignStringField("content", {
        required: true,
        trim: true,
        maxLength: MAX_CONTENT,
    });
    assignStringField("price", {
        required: true,
        trim: true,
    });
    assignStringField("strikerPrice", {
        trim: true,
        default: "",
    });

    if (errors.length) {
        throw new ValidationError(errors.join(", "));
    }

    return doc;
};

export const createWorkshop = async (data) => {
    const db = getDB();
    const now = new Date();
    const doc = {
        ...prepareWorkshopDoc(data),
        createdAt: now,
        updatedAt: now,
    };

    const result = await db.collection(WORKSHOPS_COLLECTION).insertOne(doc);
    return { ...doc, _id: result.insertedId };
};

export const listWorkshops = async ({ page = 1, limit = 10, search = "" } = {}) => {
    const db = getDB();
    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const limitNumber = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const skip = (pageNumber - 1) * limitNumber;
    const query = {};

    if (search && search.trim()) {
        const regex = new RegExp(search.trim(), "i");
        query.$or = [
            { workshopName: regex },
            { shortDescription: regex },
        ];
    }

    const collection = db.collection(WORKSHOPS_COLLECTION);
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
        data: records,
        total,
        totalPages: total ? Math.ceil(total / limitNumber) : 0,
        page: pageNumber,
        limit: limitNumber,
    };
};

export const findWorkshopById = async (id) => {
    const db = getDB();
    return await db
        .collection(WORKSHOPS_COLLECTION)
        .findOne({ _id: toObjectId(id) });
};

export const updateWorkshop = async (id, data) => {
    const db = getDB();
    const updates = prepareWorkshopDoc(data, { partial: true });

    if (!Object.keys(updates).length) {
        throw new ValidationError("At least one field must be provided to update");
    }

    updates.updatedAt = new Date();

    const result = await db.collection(WORKSHOPS_COLLECTION).findOneAndUpdate(
        { _id: toObjectId(id) },
        { $set: updates },
        { returnDocument: "after" }
    );

    return result;
};

export const deleteWorkshop = async (id) => {
    const db = getDB();
    const objectId = toObjectId(id);
    const result = await db.collection(WORKSHOPS_COLLECTION).findOneAndDelete({ _id: objectId });
    if (!result) {
        throw new ValidationError("Workshop not found");
    }
    return result;
};

export const countWorkshops = async () => {
    const db = getDB();
    return await db.collection(WORKSHOPS_COLLECTION).countDocuments({});
};
