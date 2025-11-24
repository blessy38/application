import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import {
    createProduct as createProductRecord,
    listProducts,
    findProductById,
    updateProduct as updateProductRecord,
    deleteProduct as deleteProductRecord,
    ValidationError,
    DEFAULT_PRODUCT_PHOTO,
} from "../models/Product.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsRoot = path.resolve(__dirname, "..");

const respondWithError = (res, error, fallbackMessage) => {
    if (error instanceof ValidationError) {
        return res.status(400).json({ message: error.message });
    }

    console.error(fallbackMessage, error);
    return res.status(500).json({ message: fallbackMessage });
};

const resolveUploadPath = (reference) => {
    if (!reference) return null;
    if (path.isAbsolute(reference)) return reference;
    const normalized = reference.startsWith("/")
        ? reference.slice(1)
        : reference;
    return path.resolve(uploadsRoot, normalized);
};

const deleteFileIfExists = async (reference) => {
    const target = resolveUploadPath(reference);
    if (!target || target.endsWith("default-product.png")) return;
    try {
        await fs.unlink(target);
    } catch (error) {
        if (error.code !== "ENOENT") {
            console.warn(`Failed to delete file ${target}:`, error.message);
        }
    }
};

const buildPayload = (body, productPhoto) => {
    const payload = { ...body };
    if (productPhoto) {
        payload.productPhoto = productPhoto;
    }
    return payload;
};

const cleanupOnError = async (filePath) => {
    if (filePath) {
        await deleteFileIfExists(filePath);
    }
};

export const createProduct = async (req, res) => {
    const uploadedPath = req.file?.path;
    try {
        const productPhoto = req.file
            ? `/uploads/${req.file.filename}`
            : DEFAULT_PRODUCT_PHOTO;

        const product = await createProductRecord(
            buildPayload(req.body, productPhoto)
        );

        res.status(201).json({
            message: "Product created successfully",
            data: product,
        });
    } catch (error) {
        await cleanupOnError(uploadedPath);
        respondWithError(res, error, "Failed to create product");
    }
};

export const getAllProducts = async (req, res) => {
    try {
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
        const search = req.query.search ?? "";

        const result = await listProducts({ page, limit, search });
        res.json({
            message: "Products fetched successfully",
            data: result.data,
            page: result.page,
            limit: result.limit,
            total: result.total,
            totalPages: result.totalPages,
        });
    } catch (error) {
        respondWithError(res, error, "Failed to fetch products");
    }
};

export const getProductById = async (req, res) => {
    try {
        const product = await findProductById(req.params.id);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }
        res.json({ message: "Product fetched successfully", data: product });
    } catch (error) {
        respondWithError(res, error, "Failed to fetch product");
    }
};

export const updateProduct = async (req, res) => {
    const uploadedPath = req.file?.path;
    try {
        const product = await findProductById(req.params.id);
        if (!product) {
            await cleanupOnError(uploadedPath);
            return res.status(404).json({ message: "Product not found" });
        }

        const productPhoto = req.file
            ? `/uploads/${req.file.filename}`
            : undefined;

        const updatedProduct = await updateProductRecord(
            req.params.id,
            buildPayload(req.body, productPhoto)
        );

        if (!updatedProduct) {
            await cleanupOnError(uploadedPath);
            return res.status(404).json({ message: "Product not found" });
        }

        if (productPhoto && product.productPhoto && product.productPhoto !== DEFAULT_PRODUCT_PHOTO) {
            await deleteFileIfExists(product.productPhoto);
        }

        res.json({
            message: "Product updated successfully",
            data: updatedProduct,
        });
    } catch (error) {
        await cleanupOnError(uploadedPath);
        respondWithError(res, error, "Failed to update product");
    }
};

export const deleteProduct = async (req, res) => {
    try {
        const deleted = await deleteProductRecord(req.params.id);
        if (deleted.productPhoto && deleted.productPhoto !== DEFAULT_PRODUCT_PHOTO) {
            await deleteFileIfExists(deleted.productPhoto);
        }
        res.status(204).send();
    } catch (error) {
        respondWithError(res, error, "Failed to delete product");
    }
};
