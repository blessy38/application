import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import {
    createWorkshop as createWorkshopRecord,
    listWorkshops,
    findWorkshopById,
    updateWorkshop as updateWorkshopRecord,
    deleteWorkshop as deleteWorkshopRecord,
    countWorkshops,
    ValidationError,
    DEFAULT_WORKSHOP_PHOTO,
} from "../models/Workshop.js";

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
    if (!target || target.endsWith("default-workshop.png")) return;
    try {
        await fs.unlink(target);
    } catch (error) {
        if (error.code !== "ENOENT") {
            console.warn(`Failed to delete file ${target}:`, error.message);
        }
    }
};

const buildPayload = (body, workshopPhoto) => {
    const payload = { ...body };
    if (workshopPhoto) {
        payload.workshopPhoto = workshopPhoto;
    }
    return payload;
};

const cleanupOnError = async (filePath) => {
    if (filePath) {
        await deleteFileIfExists(filePath);
    }
};

export const createWorkshop = async (req, res) => {
    const uploadedPath = req.file?.path;
    try {


        const workshopPhoto = req.file
            ? `/uploads/${req.file.filename}`
            : DEFAULT_WORKSHOP_PHOTO;

        const workshop = await createWorkshopRecord(
            buildPayload(req.body, workshopPhoto)
        );

        res.status(201).json({
            message: "Workshop created successfully",
            data: workshop,
        });
    } catch (error) {
        await cleanupOnError(uploadedPath);
        respondWithError(res, error, "Failed to create workshop");
    }
};

export const getAllWorkshops = async (req, res) => {
    try {
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
        const search = req.query.search ?? "";

        const result = await listWorkshops({ page, limit, search });
        res.json({
            message: "Workshops fetched successfully",
            data: result.data,
            page: result.page,
            limit: result.limit,
            total: result.total,
            totalPages: result.totalPages,
        });
    } catch (error) {
        respondWithError(res, error, "Failed to fetch workshops");
    }
};

export const getWorkshopById = async (req, res) => {
    try {
        const workshop = await findWorkshopById(req.params.id);
        if (!workshop) {
            return res.status(404).json({ message: "Workshop not found" });
        }
        res.json({ message: "Workshop fetched successfully", data: workshop });
    } catch (error) {
        respondWithError(res, error, "Failed to fetch workshop");
    }
};

export const updateWorkshop = async (req, res) => {
    const uploadedPath = req.file?.path;
    try {
        const workshop = await findWorkshopById(req.params.id);
        if (!workshop) {
            await cleanupOnError(uploadedPath);
            return res.status(404).json({ message: "Workshop not found" });
        }

        const workshopPhoto = req.file
            ? `/uploads/${req.file.filename}`
            : undefined;

        const updatedWorkshop = await updateWorkshopRecord(
            req.params.id,
            buildPayload(req.body, workshopPhoto)
        );

        if (!updatedWorkshop) {
            await cleanupOnError(uploadedPath);
            return res.status(404).json({ message: "Workshop not found" });
        }

        if (workshopPhoto && workshop.workshopPhoto && workshop.workshopPhoto !== DEFAULT_WORKSHOP_PHOTO) {
            await deleteFileIfExists(workshop.workshopPhoto);
        }

        res.json({
            message: "Workshop updated successfully",
            data: updatedWorkshop,
        });
    } catch (error) {
        await cleanupOnError(uploadedPath);
        respondWithError(res, error, "Failed to update workshop");
    }
};

export const deleteWorkshop = async (req, res) => {
    try {
        const deleted = await deleteWorkshopRecord(req.params.id);
        if (deleted.workshopPhoto && deleted.workshopPhoto !== DEFAULT_WORKSHOP_PHOTO) {
            await deleteFileIfExists(deleted.workshopPhoto);
        }
        res.status(204).send();
    } catch (error) {
        respondWithError(res, error, "Failed to delete workshop");
    }
};
