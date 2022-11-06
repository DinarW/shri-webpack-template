import { Compiler } from 'webpack';
import { join } from 'path';
import fsp from 'fs/promises';

class ModuleLogger {
    whiteList: RegExp[]

    constructor() {
        this.whiteList = [
            /.*node_modules.*/,
            /.*plugins.*/,
            /\.git.*$/,
            /\.idea.*$/,
            /\.json$/,
            /\.nvmrc$/,
            /\.config\.[tj]s$/,
            /\.prettierrc\.yaml$/,
            /README\.md$/,
            /index\.html$/,
            /.*utils\/whiteList.ts/
        ]
    }

    whiteListHas(path: string) {
        return this.whiteList.some(rgx => rgx.test(path));
    }

    async getModules(currentFolderPath: string): Promise<string[]> {
        const entities = await fsp.readdir(currentFolderPath, { withFileTypes: true });
        let modules: string[] = [];

        for (const entity of entities) {
            const name = entity.name;
            const isDirectory = entity.isDirectory();
            const currentPath = join(currentFolderPath, name);

            if (!this.whiteListHas(currentPath)) {
                if (isDirectory) {
                    modules = modules.concat(...(await this.getModules(currentPath)))
                } else {
                    modules.push(currentPath);
                }
            }
        }

        return modules;
    }

    apply(compiler: Compiler) {
        compiler.hooks.emit.tapPromise(ModuleLogger.name, async (compilation) => {
            const compileModules = new Set(Array.from(compilation.fileDependencies));
            const modulesProject = await this.getModules(compiler.context);

            const unused = modulesProject.filter(module => !compileModules.has(module))
            await fsp.writeFile('unused.json', JSON.stringify(unused));
        });
    }
}

export default ModuleLogger;