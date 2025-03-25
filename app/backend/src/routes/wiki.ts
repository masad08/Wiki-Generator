import express, { Request, Response } from 'express';
import { createWiki, getWikis, getWiki, updateWiki, deleteWiki, exportWiki, uploadImage, serveImage, exportWikiSingleHtml } from '../controllers/wikiController';
import multer from 'multer';
import path from 'path';
import fs from 'fs-extra';

const router = express.Router();

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Create the wiki images directory if it doesn't exist
    const wikiName = req.params.wikiName;
    const dir = path.join(__dirname, '../../../..', 'created_wikis', wikiName, 'images');
    fs.ensureDirSync(dir);
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    // Use original filename
    cb(null, file.originalname);
  }
});

const upload = multer({ storage });

// Wiki routes
router.post('/', createWiki as express.RequestHandler);
router.get('/', getWikis as express.RequestHandler);
router.get('/:wikiName', getWiki as express.RequestHandler);
router.put('/:wikiName', updateWiki as express.RequestHandler);
router.delete('/:wikiName', deleteWiki as express.RequestHandler);
router.get('/:wikiName/export', exportWiki as express.RequestHandler);
router.get('/:wikiName/export-single-html', exportWikiSingleHtml as express.RequestHandler);

// Image routes
router.post('/:wikiName/upload', upload.single('image'), uploadImage as express.RequestHandler);
router.get('/:wikiName/images/:filename', serveImage as express.RequestHandler);

export default router; 