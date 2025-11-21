import { Router } from "express";
import upload from "../middleware/upload.js";
import {
  createUser,
  getAllUsers,
  getUserById,
  getUserByTruvedaLink,
  updateUser,
  deleteUser,
} from "../controllers/userController.js";

const router = Router();

router.get("/", getAllUsers);
router.get("/link/:truvedaLink", getUserByTruvedaLink);
router.get("/:id", getUserById);
router.post("/", upload.single("profilePhoto"), createUser);
router.put("/:id", upload.single("profilePhoto"), updateUser);
router.delete("/:id", deleteUser);

export default router;

