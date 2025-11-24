import mongoose from "mongoose";

export const DEFAULT_SERVICE_PHOTO = "/uploads/default-service.png";

const MAX_SERVICE_NAME = 100;
const MAX_SHORT_DESC = 200;
const MAX_CONTENT = 5000;

export class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = "ValidationError";
    }
}

const serviceSchema = new mongoose.Schema(
    {
        servicePhoto: {
            type: String,
            default: DEFAULT_SERVICE_PHOTO,
            trim: true,
        },
        serviceName: {
            type: String,
            required: [true, "serviceName is required"],
            trim: true,
            maxlength: [MAX_SERVICE_NAME, `serviceName must be at most ${MAX_SERVICE_NAME} characters`],
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

const Service = mongoose.model("Service", serviceSchema);

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

export const createService = async (data) => {
    try {
        const service = new Service(data);
        await service.save();
        return service.toObject();
    } catch (error) {
        handleValidationError(error);
    }
};

export const listServices = async ({ page = 1, limit = 10, search = "" } = {}) => {
    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const limitNumber = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const skip = (pageNumber - 1) * limitNumber;
    const query = {};

    if (search && search.trim()) {
        const regex = new RegExp(search.trim(), "i");
        query.$or = [
            { serviceName: regex },
            { shortDescription: regex },
        ];
    }

    const [records, total] = await Promise.all([
        Service.find(query)
            .skip(skip)
            .limit(limitNumber)
            .sort({ createdAt: -1 })
            .lean(),
        Service.countDocuments(query),
    ]);

    return {
        data: records,
        total,
        totalPages: total ? Math.ceil(total / limitNumber) : 0,
        page: pageNumber,
        limit: limitNumber,
    };
};

export const findServiceById = async (id) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new ValidationError("Invalid service id");
        }
        const service = await Service.findById(id).lean();
        return service;
    } catch (error) {
        if (error instanceof ValidationError) throw error;
        throw new ValidationError("Invalid service id");
    }
};

export const updateService = async (id, data) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new ValidationError("Invalid service id");
        }

        if (!data || !Object.keys(data).length) {
            throw new ValidationError("At least one field must be provided to update");
        }

        const service = await Service.findByIdAndUpdate(
            id,
            { $set: data },
            { new: true, runValidators: true }
        ).lean();

        if (!service) {
            throw new ValidationError("Service not found");
        }

        return service;
    } catch (error) {
        handleValidationError(error);
    }
};

export const deleteService = async (id) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new ValidationError("Invalid service id");
        }

        const service = await Service.findByIdAndDelete(id).lean();
        if (!service) {
            throw new ValidationError("Service not found");
        }
        return service;
    } catch (error) {
        if (error instanceof ValidationError) throw error;
        throw new ValidationError("Service not found");
    }
};

export const countServices = async () => {
    return await Service.countDocuments({});
};

export default Service;
