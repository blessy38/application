import { Router } from "express";
import upload from "../middleware/upload.js";
import {
    createProduct,
    getAllProducts,
    getProductById,
    updateProduct,
    deleteProduct,
} from "../controllers/productController.js";

const router = Router();

router.get("/", getAllProducts);
router.get("/:id", getProductById);
router.post("/", upload.single("productPhoto"), createProduct);
router.put("/:id", upload.single("productPhoto"), updateProduct);
router.delete("/:id", deleteProduct);

export default router;
