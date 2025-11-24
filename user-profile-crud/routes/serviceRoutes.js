import { Router } from "express";
import upload from "../middleware/upload.js";
import {
    createService,
    getAllServices,
    getServiceById,
    updateService,
    deleteService,
} from "../controllers/serviceController.js";

const router = Router();

router.get("/", getAllServices);
router.get("/:id", getServiceById);
router.post("/", upload.single("servicePhoto"), createService);
router.put("/:id", upload.single("servicePhoto"), updateService);
router.delete("/:id", deleteService);

export default router;
