import mongoose from "mongoose";

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

const workshopSchema = new mongoose.Schema(
    {
        workshopPhoto: {
            type: String,
            default: DEFAULT_WORKSHOP_PHOTO,
            trim: true,
        },
        workshopName: {
            type: String,
            required: [true, "workshopName is required"],
            trim: true,
            maxlength: [MAX_WORKSHOP_NAME, `workshopName must be at most ${MAX_WORKSHOP_NAME} characters`],
        },
        shortDescription: {
            type: String,
            required: [true, "shortDescription is required"],
            trim: true,
            maxlength: [MAX_SHORT_DESC, `shortDescription must be at most ${MAX_SHORT_DESC} characters`],
        },
        content: {
            type: String,
            required: [true, "content is required"],
            trim: true,
            maxlength: [MAX_CONTENT, `content must be at most ${MAX_CONTENT} characters`],
        },
        price: {
            type: String,
            required: [true, "price is required"],
            trim: true,
        },
        strikerPrice: {
            type: String,
            default: "",
            trim: true,
        },
    },
    {
        timestamps: true,
    }
);

const Workshop = mongoose.model("Workshop", workshopSchema);

// Helper function to handle Mongoose validation errors
const handleValidationError = (error) => {
    if (error.name === "ValidationError") {
        const messages = Object.values(error.errors).map((err) => err.message);
        throw new ValidationError(messages.join(", "));
    }
    if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        throw new ValidationError(`${field} already exists`);
    }
    throw error;
};

export const createWorkshop = async (data) => {
    try {
        const workshop = new Workshop(data);
        await workshop.save();
        return workshop.toObject();
    } catch (error) {
        handleValidationError(error);
    }
};

export const listWorkshops = async ({ page = 1, limit = 10, search = "" } = {}) => {
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

    const [records, total] = await Promise.all([
        Workshop.find(query)
            .skip(skip)
            .limit(limitNumber)
            .sort({ createdAt: -1 })
            .lean(),
        Workshop.countDocuments(query),
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
    try {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new ValidationError("Invalid workshop id");
        }
        const workshop = await Workshop.findById(id).lean();
        return workshop;
    } catch (error) {
        if (error instanceof ValidationError) throw error;
        throw new ValidationError("Invalid workshop id");
    }
};

export const updateWorkshop = async (id, data) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new ValidationError("Invalid workshop id");
        }

        if (!data || !Object.keys(data).length) {
            throw new ValidationError("At least one field must be provided to update");
        }

        const workshop = await Workshop.findByIdAndUpdate(
            id,
            { $set: data },
            { new: true, runValidators: true }
        ).lean();

        if (!workshop) {
            throw new ValidationError("Workshop not found");
        }

        return workshop;
    } catch (error) {
        handleValidationError(error);
    }
};

export const deleteWorkshop = async (id) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new ValidationError("Invalid workshop id");
        }

        const workshop = await Workshop.findByIdAndDelete(id).lean();
        if (!workshop) {
            throw new ValidationError("Workshop not found");
        }
        return workshop;
    } catch (error) {
        if (error instanceof ValidationError) throw error;
        throw new ValidationError("Workshop not found");
    }
};

export const countWorkshops = async () => {
    return await Workshop.countDocuments({});
};

export default Workshop;
