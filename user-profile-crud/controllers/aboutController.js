import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import {
    createAbout as createAboutRecord,
    listAbouts,
    findAboutById,
    updateAbout as updateAboutRecord,
    deleteAbout as deleteAboutRecord,
    ValidationError,
} from "../models/About.js";

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
    if (!target) return;
    try {
        await fs.unlink(target);
    } catch (error) {
        if (error.code !== "ENOENT") {
            console.warn(`Failed to delete file ${target}:`, error.message);
        }
    }
};

const buildPayload = (body, images) => {
    const payload = { ...body };
    if (images && images.length > 0) {
        payload.images = images;
    }
    return payload;
};

const cleanupOnError = async (files) => {
    if (files && files.length > 0) {
        for (const file of files) {
            await deleteFileIfExists(file.path);
        }
    }
};

export const createAbout = async (req, res) => {
    const uploadedFiles = req.files || [];
    try {
        const images = uploadedFiles.map(file => `/uploads/${file.filename}`);

        const about = await createAboutRecord(
            buildPayload(req.body, images)
        );

        res.status(201).json({
            message: "About entry created successfully",
            data: about,
        });
    } catch (error) {
        await cleanupOnError(uploadedFiles);
        respondWithError(res, error, "Failed to create about entry");
    }
};

export const getAllAbouts = async (req, res) => {
    try {
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);

        const result = await listAbouts({ page, limit });
        res.json({
            message: "About entries fetched successfully",
            data: result.data,
            page: result.page,
            limit: result.limit,
            total: result.total,
            totalPages: result.totalPages,
        });
    } catch (error) {
        respondWithError(res, error, "Failed to fetch about entries");
    }
};

export const getAboutById = async (req, res) => {
    try {
        const about = await findAboutById(req.params.id);
        if (!about) {
            return res.status(404).json({ message: "About entry not found" });
        }
        res.json({ message: "About entry fetched successfully", data: about });
    } catch (error) {
        respondWithError(res, error, "Failed to fetch about entry");
    }
};

export const updateAbout = async (req, res) => {
    const uploadedFiles = req.files || [];
    try {
        const about = await findAboutById(req.params.id);
        if (!about) {
            await cleanupOnError(uploadedFiles);
            return res.status(404).json({ message: "About entry not found" });
        }

        const images = uploadedFiles.length > 0
            ? uploadedFiles.map(file => `/uploads/${file.filename}`)
            : undefined;

        const updatedAbout = await updateAboutRecord(
            req.params.id,
            buildPayload(req.body, images)
        );

        if (!updatedAbout) {
            await cleanupOnError(uploadedFiles);
            return res.status(404).json({ message: "About entry not found" });
        }

        // If new images were uploaded, delete the old ones
        if (images && about.images && about.images.length > 0) {
            for (const oldImage of about.images) {
                await deleteFileIfExists(oldImage);
            }
        }

        res.json({
            message: "About entry updated successfully",
            data: updatedAbout,
        });
    } catch (error) {
        await cleanupOnError(uploadedFiles);
        respondWithError(res, error, "Failed to update about entry");
    }
};

export const deleteAbout = async (req, res) => {
    try {
        const deleted = await deleteAboutRecord(req.params.id);
        if (deleted.images && deleted.images.length > 0) {
            for (const image of deleted.images) {
                await deleteFileIfExists(image);
            }
        }
        res.status(204).send();
    } catch (error) {
        respondWithError(res, error, "Failed to delete about entry");
    }
};
