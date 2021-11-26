﻿using System.Collections.Generic;
using System.Linq;

namespace DotNetJS.Packer
{
    public static class UMD
    {
        private const string moduleTemplate = @"
(function (root, factory) {
    if (typeof exports === 'object' && typeof exports.nodeName !== 'string')
        factory(module.exports, Object.assign({}, module.exports));
    else factory(Object.assign(root.%LIBRARY%, root.dotnet), root.dotnet);
}(typeof self !== 'undefined' ? self : this, function (exports, dotnet) {
    exports.boot = async function () {
        const bootData = {
            wasm: '%WASM%',
            assemblies: [%DLLS%],
            entryAssemblyName: '%ENTRY%'
        };
        await dotnet.boot(bootData);
    };
}));";

        private const string assemblyTemplate = "{ name: '%NAME%', data: '%DATA%' }";

        public static string GenerateJS (string libraryName, string entryName, string wasmBase64, IEnumerable<Assembly> assemblies)
        {
            var dlls = string.Join(",", assemblies.Select(GenerateAssembly));
            return moduleTemplate
                .Replace("%ENTRY%", entryName)
                .Replace("%LIBRARY%", libraryName)
                .Replace("%WASM%", wasmBase64)
                .Replace("%DLLS%", dlls);
        }

        private static string GenerateAssembly (Assembly assembly)
        {
            return assemblyTemplate
                .Replace("%NAME%", assembly.Name)
                .Replace("%DATA%", assembly.Base64);
        }
    }
}