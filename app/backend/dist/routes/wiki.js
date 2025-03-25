"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const wikiController_1 = require("../controllers/wikiController");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const router = express_1.default.Router();
// Configure multer for image uploads
const storage = multer_1.default.diskStorage({
    destination: function (req, file, cb) {
        // Create the wiki images directory if it doesn't exist
        const wikiName = req.params.wikiName;
        const dir = path_1.default.join(__dirname, '../../../..', 'created_wikis', wikiName, 'images');
        fs_extra_1.default.ensureDirSync(dir);
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        // Use original filename
        cb(null, file.originalname);
    }
});
const upload = (0, multer_1.default)({ storage });
// Wiki routes
router.post('/', wikiController_1.createWiki);
router.get('/', wikiController_1.getWikis);
router.get('/:wikiName', wikiController_1.getWiki);
router.put('/:wikiName', wikiController_1.updateWiki);
router.delete('/:wikiName', wikiController_1.deleteWiki);
router.get('/:wikiName/export', wikiController_1.exportWiki);
router.get('/:wikiName/export-single-html', wikiController_1.exportWikiSingleHtml);
// Image routes
router.post('/:wikiName/upload', upload.single('image'), wikiController_1.uploadImage);
router.get('/:wikiName/images/:filename', wikiController_1.serveImage);
exports.default = router;
