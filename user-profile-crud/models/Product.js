import mongoose from "mongoose";

export const DEFAULT_PRODUCT_PHOTO = "/uploads/default-product.png";

const MAX_PRODUCT_NAME = 100;
const MAX_SHORT_DESC = 200;
const MAX_CONTENT = 5000;

export class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = "ValidationError";
    }
}

const productSchema = new mongoose.Schema(
    {
        productPhoto: {
            type: String,
            default: DEFAULT_PRODUCT_PHOTO,
            trim: true,
        },
        productName: {
            type: String,
            required: [true, "productName is required"],
            trim: true,
            maxlength: [MAX_PRODUCT_NAME, `productName must be at most ${MAX_PRODUCT_NAME} characters`],
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

const Product = mongoose.model("Product", productSchema);

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

export const createProduct = async (data) => {
    try {
        const product = new Product(data);
        await product.save();
        return product.toObject();
    } catch (error) {
        handleValidationError(error);
    }
};

export const listProducts = async ({ page = 1, limit = 10, search = "" } = {}) => {
    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const limitNumber = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const skip = (pageNumber - 1) * limitNumber;
    const query = {};

    if (search && search.trim()) {
        const regex = new RegExp(search.trim(), "i");
        query.$or = [
            { productName: regex },
            { shortDescription: regex },
        ];
    }

    const [records, total] = await Promise.all([
        Product.find(query)
            .skip(skip)
            .limit(limitNumber)
            .sort({ createdAt: -1 })
            .lean(),
        Product.countDocuments(query),
    ]);

    return {
        data: records,
        total,
        totalPages: total ? Math.ceil(total / limitNumber) : 0,
        page: pageNumber,
        limit: limitNumber,
    };
};

export const findProductById = async (id) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new ValidationError("Invalid product id");
        }
        const product = await Product.findById(id).lean();
        return product;
    } catch (error) {
        if (error instanceof ValidationError) throw error;
        throw new ValidationError("Invalid product id");
    }
};

export const updateProduct = async (id, data) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new ValidationError("Invalid product id");
        }

        if (!data || !Object.keys(data).length) {
            throw new ValidationError("At least one field must be provided to update");
        }

        const product = await Product.findByIdAndUpdate(
            id,
            { $set: data },
            { new: true, runValidators: true }
        ).lean();

        if (!product) {
            throw new ValidationError("Product not found");
        }

        return product;
    } catch (error) {
        handleValidationError(error);
    }
};

export const deleteProduct = async (id) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new ValidationError("Invalid product id");
        }

        const product = await Product.findByIdAndDelete(id).lean();
        if (!product) {
            throw new ValidationError("Product not found");
        }
        return product;
    } catch (error) {
        if (error instanceof ValidationError) throw error;
        throw new ValidationError("Product not found");
    }
};

export default Product;
