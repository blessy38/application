import mongoose from "mongoose";

const MAX_DESCRIPTION = 5000; // Approx 1000 words
const MAX_IMAGES = 4;

export class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = "ValidationError";
    }
}

const aboutSchema = new mongoose.Schema(
    {
        description: {
            type: String,
            required: [true, "description is required"],
            trim: true,
            maxlength: [MAX_DESCRIPTION, `description must be at most ${MAX_DESCRIPTION} characters`],
        },
        images: {
            type: [String],
            default: [],
            validate: {
                validator: function (v) {
                    return v.length <= MAX_IMAGES;
                },
                message: `You can upload up to ${MAX_IMAGES} images`,
            },
        },
    },
    {
        timestamps: true,
    }
);

const About = mongoose.model("About", aboutSchema);

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

export const createAbout = async (data) => {
    try {
        const about = new About(data);
        await about.save();
        return about.toObject();
    } catch (error) {
        handleValidationError(error);
    }
};

export const listAbouts = async ({ page = 1, limit = 10 } = {}) => {
    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const limitNumber = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const skip = (pageNumber - 1) * limitNumber;

    const [records, total] = await Promise.all([
        About.find({})
            .skip(skip)
            .limit(limitNumber)
            .sort({ createdAt: -1 })
            .lean(),
        About.countDocuments({}),
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
    try {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new ValidationError("Invalid about id");
        }
        const about = await About.findById(id).lean();
        return about;
    } catch (error) {
        if (error instanceof ValidationError) throw error;
        throw new ValidationError("Invalid about id");
    }
};

export const updateAbout = async (id, data) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new ValidationError("Invalid about id");
        }

        if (!data || !Object.keys(data).length) {
            throw new ValidationError("At least one field must be provided to update");
        }

        const about = await About.findByIdAndUpdate(
            id,
            { $set: data },
            { new: true, runValidators: true }
        ).lean();

        if (!about) {
            throw new ValidationError("About entry not found");
        }

        return about;
    } catch (error) {
        handleValidationError(error);
    }
};

export const deleteAbout = async (id) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new ValidationError("Invalid about id");
        }

        const about = await About.findByIdAndDelete(id).lean();
        if (!about) {
            throw new ValidationError("About entry not found");
        }
        return about;
    } catch (error) {
        if (error instanceof ValidationError) throw error;
        throw new ValidationError("About entry not found");
    }
};

export default About;
