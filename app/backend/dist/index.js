"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const wiki_1 = __importDefault(require("./routes/wiki"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Create created_wikis directory if it doesn't exist
const wikiDir = path_1.default.join(__dirname, '../../..', 'created_wikis');
fs_extra_1.default.ensureDirSync(wikiDir);
// Static files
app.use('/wikis', express_1.default.static(wikiDir));
// Routes
app.use('/api/wiki', wiki_1.default);
// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
exports.default = app;
