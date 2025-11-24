import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import {
    createService as createServiceRecord,
    listServices,
    findServiceById,
    updateService as updateServiceRecord,
    deleteService as deleteServiceRecord,
    countServices,
    ValidationError,
    DEFAULT_SERVICE_PHOTO,
} from "../models/Service.js";

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
    if (!target || target.endsWith("default-service.png")) return;
    try {
        await fs.unlink(target);
    } catch (error) {
        if (error.code !== "ENOENT") {
            console.warn(`Failed to delete file ${target}:`, error.message);
        }
    }
};

const buildPayload = (body, servicePhoto) => {
    const payload = { ...body };
    if (servicePhoto) {
        payload.servicePhoto = servicePhoto;
    }
    return payload;
};

const cleanupOnError = async (filePath) => {
    if (filePath) {
        await deleteFileIfExists(filePath);
    }
};

export const createService = async (req, res) => {
    const uploadedPath = req.file?.path;
    try {


        const servicePhoto = req.file
            ? `/uploads/${req.file.filename}`
            : DEFAULT_SERVICE_PHOTO;

        const service = await createServiceRecord(
            buildPayload(req.body, servicePhoto)
        );

        res.status(201).json({
            message: "Service created successfully",
            data: service,
        });
    } catch (error) {
        await cleanupOnError(uploadedPath);
        respondWithError(res, error, "Failed to create service");
    }
};

export const getAllServices = async (req, res) => {
    try {
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
        const search = req.query.search ?? "";

        const result = await listServices({ page, limit, search });
        res.json({
            message: "Services fetched successfully",
            data: result.data,
            page: result.page,
            limit: result.limit,
            total: result.total,
            totalPages: result.totalPages,
        });
    } catch (error) {
        respondWithError(res, error, "Failed to fetch services");
    }
};

export const getServiceById = async (req, res) => {
    try {
        const service = await findServiceById(req.params.id);
        if (!service) {
            return res.status(404).json({ message: "Service not found" });
        }
        res.json({ message: "Service fetched successfully", data: service });
    } catch (error) {
        respondWithError(res, error, "Failed to fetch service");
    }
};

export const updateService = async (req, res) => {
    const uploadedPath = req.file?.path;
    try {
        const service = await findServiceById(req.params.id);
        if (!service) {
            await cleanupOnError(uploadedPath);
            return res.status(404).json({ message: "Service not found" });
        }

        const servicePhoto = req.file
            ? `/uploads/${req.file.filename}`
            : undefined;

        const updatedService = await updateServiceRecord(
            req.params.id,
            buildPayload(req.body, servicePhoto)
        );

        if (!updatedService) {
            await cleanupOnError(uploadedPath);
            return res.status(404).json({ message: "Service not found" });
        }

        if (servicePhoto && service.servicePhoto && service.servicePhoto !== DEFAULT_SERVICE_PHOTO) {
            await deleteFileIfExists(service.servicePhoto);
        }

        res.json({
            message: "Service updated successfully",
            data: updatedService,
        });
    } catch (error) {
        await cleanupOnError(uploadedPath);
        respondWithError(res, error, "Failed to update service");
    }
};

export const deleteService = async (req, res) => {
    try {
        const deleted = await deleteServiceRecord(req.params.id);
        if (deleted.servicePhoto && deleted.servicePhoto !== DEFAULT_SERVICE_PHOTO) {
            await deleteFileIfExists(deleted.servicePhoto);
        }
        res.status(204).send();
    } catch (error) {
        respondWithError(res, error, "Failed to delete service");
    }
};
