import * as express from 'express';
import * as dotenv from 'dotenv';
import * as http from 'http';
import { promises as fsPromises } from 'fs';
import * as path from 'path';
import { Logger } from './logger';
import * as multer from 'multer';

const SERVICE_VERSION: string = '1.0.0';
const API_VERSION: string = '1.0';

const Server = new class {
    private expressServer: express.Express;

    constructor(){
        this.dispose = this.dispose.bind(this);
    }

    private async ensureFolderExists(folderPath: string): Promise<void> {
        try {
            await fsPromises.mkdir(folderPath, {recursive: true});
        }
        catch {}
    }

    private isValidName(name: string): boolean {
        return /^[a-zA-Z0-9.\-_]{1,100}$/.test(name);
    }

    private getPath(subpath: string): string {
        return path.join(__dirname, subpath);
    }

    public createJSONResponse(request: express.Request): any {
        const result: any = {
            apiVersion: API_VERSION
        };
        if(request.query.context && (request.query.context as string).trim().length > 0){
            result.context = request.query.context;
        }
        return result;
    }

    public async start(): Promise<void> {
        // Logger
        await Logger.initialize({
            console: true,
            file: true,
            fileFolder: this.getPath('data/logs')
        });
        await Logger.info(`Simple Repository server v${SERVICE_VERSION}`);

        // Check for folders
        await this.ensureFolderExists(this.getPath('data/files'));
        await this.ensureFolderExists(this.getPath('data/uploads'));

        // Config
        dotenv.config();
        const defaultOptions: any = {
            PORT: 80,
            PROXY: 0,
            SECRET_UPLOAD: '',
            SECRET_DOWNLOAD: ''
        };
        for(const [key, value] of Object.entries(defaultOptions)){
            if(!(key in process.env)){
                process.env[key] = `${value}`;
            }
        }
        if(process.env.SECRET_UPLOAD.trim().length === 0 || process.env.SECRET_DOWNLOAD.trim().length === 0){
            await Logger.error('Secrets are empty! Aborting...');
            process.exit(1);
        }

        // Handle abord signal / keyboard
        process.on('SIGINT', this.dispose);
        process.on('SIGTERM', this.dispose);

        // Start HTTP server
        this.expressServer = express();
        this.expressServer.set('trust proxy', `${parseInt(process.env.PROXY)}` === `${process.env.PROXY}` ? parseInt(process.env.PROXY as string) : process.env.PROXY);

        // Check for key
        this.expressServer.use((req: express.Request, res: express.Response, next: express.NextFunction)=>{
            if(!('key' in req.query) || (req.query.key !== process.env.SECRET_UPLOAD && req.query.key !== process.env.SECRET_DOWNLOAD)){
                const response: any = this.createJSONResponse(req);
                response.error = {
                    code: 401,
                    message: 'Unauthorized'
                };
                res.status(401).json(response);
                return;
            }
            req.authType = req.query.key === process.env.SECRET_UPLOAD ? 'upload' : 'download';
            next();
        });

        // No cache
        this.expressServer.use((req: express.Request, res: express.Response, next: express.NextFunction)=>{
            res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
            res.header('Expires', '-1');
            res.header('Pragma', 'no-cache');
            next();
        });

        // Uploader
        const uploader: multer.Multer = multer({
            dest: this.getPath('data/uploads')
        });

        // Routes
        this.expressServer.post('/api/upload', uploader.single('file'), async (req: express.Request, res: express.Response)=>{
            const response: any = this.createJSONResponse(req);

            // Check correct access
            if(req.authType !== 'upload'){
                const response: any = this.createJSONResponse(req);
                response.error = {
                    code: 500,
                    message: 'Forbidden'
                };
                res.status(500).json(response);
                return;
            }

            // Check inputs
            if(!['project', 'filename'].every(p => p in req.body && req.body[p].trim().length > 0 && this.isValidName(req.body[p]))){
                const response: any = this.createJSONResponse(req);
                response.error = {
                    code: 400,
                    message: 'Bad request'
                };
                res.status(400).json(response);
                return;
            }

            // Test project folder
            await this.ensureFolderExists(this.getPath(path.join('data/files', req.body.project)));

            // Move uploaded files
            await fsPromises.rename(req.file.path, this.getPath(path.join('data/files', req.body.project, req.body.filename)));

            res.json(response);
        });

        this.expressServer.get('/api/projects', async (req: express.Request, res: express.Response)=>{
            const response: any = this.createJSONResponse(req);
            const content: string[] = (await fsPromises.readdir(this.getPath('data/files'), {withFileTypes: true})).filter(entry => {
                return entry.isDirectory();
            }).map(folder => folder.name);
            response.data = {
                kind: "projects",
                totalItems: content.length,
                currentItemCount: content.length,
                items: content
            };
            res.json(response);
        });

        this.expressServer.get('/api/:project/list', async (req: express.Request, res: express.Response)=>{
            const response: any = this.createJSONResponse(req);
            try {
                if(!this.isValidName(req.params.project)){
                    throw new Error();
                }

                const content: string[] = (await fsPromises.readdir(this.getPath(path.join('data/files', req.params.project)), {withFileTypes: true})).filter(entry => {
                    return entry.isFile();
                }).map(file => file.name);
                response.data = {
                    kind: "files",
                    totalItems: content.length,
                    currentItemCount: content.length,
                    items: content
                };
                res.json(response);
            }
            catch {
                response.error = {
                    code: 404,
                    message: 'Not found'
                };
                res.status(404).json(response);
            }
        });

        // Files
        this.expressServer.get('/:project/:file', async (req: express.Request, res: express.Response)=>{
            const response: any = this.createJSONResponse(req);
            try {
                if(!this.isValidName(req.params.project) || !this.isValidName(req.params.file)){
                    throw new Error();
                }

                const filePath: string = this.getPath(path.join('data/files', req.params.project, req.params.file));
                await fsPromises.access(filePath);
                res.download(filePath);
            }
            catch {
                response.error = {
                    code: 404,
                    message: 'Not found'
                };
                res.status(404).json(response);
            }
        });

        // 404
        this.expressServer.use(async (req: express.Request, res: express.Response)=>{
            const response: any = this.createJSONResponse(req);
            response.error = {
                code: 404,
                message: 'Not found'
            };
            res.status(404).json(response);
        });

        // Errors
        this.expressServer.use(async (err: Error, req: express.Request, res: express.Response, next: express.NextFunction)=>{
            Logger.error(`${err.message} - ${err.stack}`);
            const response: any = this.createJSONResponse(req);
            response.error = {
                code: 500,
                message: 'An error occured'
            };
            res.status(500).json(response);
        });

        // Start main server on HTTP
        http.createServer(this.expressServer).listen(process.env.PORT, ()=>{
            Logger.info(`Now listening on port ${process.env.PORT}`);
        });
    }

    public async dispose(): Promise<void> {
        Logger.info('Stopping server...');
        process.exit(0);
    }
}

Server.start();