import { Router } from "express";
import upload from "../middleware/upload.js";
import {
    createAbout,
    getAllAbouts,
    getAboutById,
    updateAbout,
    deleteAbout,
} from "../controllers/aboutController.js";

const router = Router();

router.get("/", getAllAbouts);
router.get("/:id", getAboutById);
router.post("/", upload.array("aboutImages", 4), createAbout);
router.put("/:id", upload.array("aboutImages", 4), updateAbout);
router.delete("/:id", deleteAbout);

export default router;
