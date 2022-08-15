declare namespace Express {
    export interface Request {
       authType?: 'upload'|'download';
    }
}