import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import {
  createUser as createUserRecord,
  listUsers,
  findUserById,
  findUserByEmail,
  findUserByTruvedaLink,
  updateUser as updateUserRecord,
  deleteUser as deleteUserRecord,
  ValidationError,
  DEFAULT_PROFILE_PHOTO,
} from "../models/User.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsRoot = path.resolve(__dirname, "..");

const respondWithError = (res, error, fallbackMessage) => {
  if (error instanceof ValidationError) {
    return res.status(400).json({ message: error.message });
  }

  if (error?.code === 11000) {
    const fields = Object.keys(error.keyValue || {}).join(", ");
    return res
      .status(409)
      .json({ message: `Duplicate value for field(s): ${fields}` });
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
  if (!target || target.endsWith("default-avatar.png")) return;
  try {
    await fs.unlink(target);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.warn(`Failed to delete file ${target}:`, error.message);
    }
  }
};

const parseSocialLinksInput = (value) => {
  if (!value) return undefined;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error();
      }
      return parsed;
    } catch {
      throw new ValidationError(
        "socialLinks must be a valid JSON object string"
      );
    }
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    return value;
  }

  throw new ValidationError("socialLinks must be a valid object");
};

const buildPayload = (body, profilePhoto, socialLinksOverride) => {
  const payload = { ...body };
  if ("socialLinks" in payload) {
    delete payload.socialLinks;
  }
  if (profilePhoto) {
    payload.profilePhoto = profilePhoto;
  }
  if (socialLinksOverride !== undefined) {
    payload.socialLinks = socialLinksOverride;
  }
  return payload;
};

const cleanupOnError = async (filePath) => {
  if (filePath) {
    await deleteFileIfExists(filePath);
  }
};

export const createUser = async (req, res) => {
  const uploadedPath = req.file?.path;
  try {
    const socialLinks = parseSocialLinksInput(req.body.socialLinks);
    const emailExists = await findUserByEmail(req.body.email);
    if (emailExists) {
      await cleanupOnError(uploadedPath);
      return res.status(409).json({ message: "Email already exists" });
    }

    const linkExists = await findUserByTruvedaLink(req.body.truvedaLink);
    if (linkExists) {
      await cleanupOnError(uploadedPath);
      return res.status(409).json({ message: "truvedaLink already exists" });
    }

    const profilePhoto = req.file
      ? `/uploads/${req.file.filename}`
      : DEFAULT_PROFILE_PHOTO;
    const user = await createUserRecord(
      buildPayload(req.body, profilePhoto, socialLinks)
    );

    res.status(201).json({
      message: "User created successfully",
      data: user,
    });
  } catch (error) {
    await cleanupOnError(uploadedPath);
    respondWithError(res, error, "Failed to create user");
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
    const search = req.query.search ?? "";

    const result = await listUsers({ page, limit, search });
    res.json({
      message: "Users fetched successfully",
      data: result.data,
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
    });
  } catch (error) {
    respondWithError(res, error, "Failed to fetch users");
  }
};

export const getUserById = async (req, res) => {
  try {
    const user = await findUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ message: "User fetched successfully", data: user });
  } catch (error) {
    respondWithError(res, error, "Failed to fetch user");
  }
};

export const getUserByTruvedaLink = async (req, res) => {
  try {
    const user = await findUserByTruvedaLink(req.params.truvedaLink);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ message: "User fetched successfully", data: user });
  } catch (error) {
    respondWithError(res, error, "Failed to fetch user by truvedaLink");
  }
};

export const updateUser = async (req, res) => {
  const uploadedPath = req.file?.path;
  try {
    const user = await findUserById(req.params.id);
    if (!user) {
      await cleanupOnError(uploadedPath);
      return res.status(404).json({ message: "User not found" });
    }

    if (req.body.email) {
      const other = await findUserByEmail(req.body.email);
      if (other && other._id.toString() !== user._id.toString()) {
        await cleanupOnError(uploadedPath);
        return res.status(409).json({ message: "Email already exists" });
      }
    }

    if (req.body.truvedaLink) {
      const other = await findUserByTruvedaLink(req.body.truvedaLink);
      if (other && other._id.toString() !== user._id.toString()) {
        await cleanupOnError(uploadedPath);
        return res.status(409).json({ message: "truvedaLink already exists" });
      }
    }

    const socialLinks = req.body.socialLinks
      ? parseSocialLinksInput(req.body.socialLinks)
      : undefined;

    const profilePhoto = req.file
      ? `/uploads/${req.file.filename}`
      : undefined;

    const updatedUser = await updateUserRecord(
      req.params.id,
      buildPayload(req.body, profilePhoto, socialLinks)
    );

    if (!updatedUser) {
      await cleanupOnError(uploadedPath);
      return res.status(404).json({ message: "User not found" });
    }

    if (profilePhoto && user.profilePhoto && user.profilePhoto !== DEFAULT_PROFILE_PHOTO) {
      await deleteFileIfExists(user.profilePhoto);
    }

    res.json({
      message: "User updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    await cleanupOnError(uploadedPath);
    respondWithError(res, error, "Failed to update user");
  }
};

export const deleteUser = async (req, res) => {
  try {
    const deleted = await deleteUserRecord(req.params.id);
    if (deleted.profilePhoto && deleted.profilePhoto !== DEFAULT_PROFILE_PHOTO) {
      await deleteFileIfExists(deleted.profilePhoto);
    }
    res.status(204).send();
  } catch (error) {
    respondWithError(res, error, "Failed to delete user");
  }
};


