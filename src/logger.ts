import * as path from 'path';
import { promises as fsPromises } from 'fs';

export interface LoggerLabels {
    [key: string]: string;
}

export type LoggerSeverity = 'debug'|'info'|'notice'|'warning'|'err';

export interface LoggerOptions {
    file: boolean;
    fileFolder: string;
    console: boolean;
}

export const Logger = new class {
    private options: LoggerOptions = null;

    /**
     * Initializes the logger
     */
    public async initialize(options: LoggerOptions): Promise<void>{
        this.options = options;

        // Create log folders
        if(this.options.file){
            try {
                await fsPromises.mkdir(this.options.fileFolder, {
                    recursive: true
                });
            }
            catch(e: any){
                if(e.code !== 'EEXIST'){
                    console.error('Could not create log folder.');
                    process.exit(1);
                }
            }
        }

        // Catch exceptions
        process.on('uncaughtException', async (err: Error)=>{
            await this.log('err', `${err} - ${err.stack}`)
            process.exit(1);
        });
        process.on('unhandledRejection', async (err: Error)=>{
            await this.log('err', `${err} - ${err.stack}`)
        });
    }

    /**
     * Returns the filepath for the current logfile
     */
    private getFilepath(): string {
        return path.join(this.options.fileFolder, `${(new Date()).toISOString().split('T')[0]}.txt`);
    }

    /**
     * Returns the date as a string
     */
    private getDate(): string {
        return (new Date()).toISOString().replace('T', ' ').split('.')[0];
    }

    /**
     * Logs a message
     * @param type 
     * @param message 
     */
    public async log(severity: LoggerSeverity, message: string): Promise<void> {
        const fullLine: string = `${this.getDate()} ${severity.toUpperCase()} ${message}`;

        // Console
        if(this.options.console){
            if(severity === 'err'){
                console.error(fullLine);
            }
            else {
                console.log(fullLine);
            }
        }

        // File
        if(this.options.file){
            await fsPromises.appendFile(this.getFilepath(), `${fullLine}\n`, 'utf8');
        }
    }

    /**
     * Outputs an info message
     */
    public async debug(message: string): Promise<void>{
        await this.log('debug', message);
    }

    /**
     * Outputs an info message
     */
    public async info(message: string): Promise<void>{
        await this.log('info', message);
    }

    /**
     * Outputs an info message
     */
    public async notice(message: string): Promise<void>{
        await this.log('notice', message);
    }

    /**
     * Outputs a warning message
     */
    public async warning(message: string): Promise<void>{
        await this.log('warning', message);
    }

    /**
     * Outputs an error message
     */
    public async error(message: string): Promise<void>{
        await this.log('err', message);
    }
}