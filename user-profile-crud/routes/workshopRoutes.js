import { Router } from "express";
import upload from "../middleware/upload.js";
import {
    createWorkshop,
    getAllWorkshops,
    getWorkshopById,
    updateWorkshop,
    deleteWorkshop,
} from "../controllers/workshopController.js";

const router = Router();

router.get("/", getAllWorkshops);
router.get("/:id", getWorkshopById);
router.post("/", upload.single("workshopPhoto"), createWorkshop);
router.put("/:id", upload.single("workshopPhoto"), updateWorkshop);
router.delete("/:id", deleteWorkshop);

export default router;
