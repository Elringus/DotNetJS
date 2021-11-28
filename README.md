# DotNetJS

[![NuGet](https://img.shields.io/nuget/v/DotNetJS)](https://www.nuget.org/packages/DotNetJS)
[![npm](https://img.shields.io/npm/v/dotnet-runtime)](https://www.npmjs.com/package/dotnet-runtime)
[![CodeFactor](https://codefactor.io/repository/github/elringus/dotnetjs/badge/main)](https://codefactor.io/repository/github/elringus/dotnetjs/overview/main)
[![codecov](https://codecov.io/gh/Elringus/DotNetJS/branch/main/graph/badge.svg?token=AAhei51ETt)](https://codecov.io/gh/Elringus/DotNetJS)
[![CodeQL](https://github.com/Elringus/DotNetJS/actions/workflows/codeql.yml/badge.svg)](https://github.com/Elringus/DotNetJS/actions/workflows/codeql.yml)

This project is dedicated to providing user-friendly workflow for consuming .NET C# programs and libraries in any JavaScript environment, be it web browsers, Node.js or custom restricted spaces, like [web extensions](https://code.visualstudio.com/api/extension-guides/web-extensions) for VS Code.

The solution is based on two main components:

 - [JavaScript/dotnet-runtime](https://github.com/Elringus/DotNetJS/tree/main/JavaScript/dotnet-runtime) ([npm](https://www.npmjs.com/package/dotnet-runtime)). Consumes compiled C# assemblies and .NET runtime WebAssembly module to provide C# interoperability layer in JavaScript. The library is environment-agnostic — it doesn't depend on platform-specific APIs, like browser DOM or node modules and can be imported as CommonJS or ECMAScript module or consumed via script tag in browsers.
 - [DotNet/DotNetJS](https://github.com/Elringus/DotNetJS/tree/main/DotNet/DotNetJS) ([NuGet](https://www.nuget.org/packages/DotNetJS)). Provides JavaScript interoperability layer in C# and packs project output into single-file JavaScript library via MSBuild task. Produced library contains dotnet-runtime initialized with the project assemblies and ready to be used as interoperability layer for the packaged C# project. Can optionally emit type definitions to bootstrap TypeScript development.

## Quick Start

In C# project configuration file specify `Microsoft.NET.Sdk.BlazorWebAssembly` SDK and import `DotNetJS` NuGet package:

```xml
<Project Sdk="Microsoft.NET.Sdk.BlazorWebAssembly">

    <PropertyGroup>
        <TargetFramework>net6.0</TargetFramework>
    </PropertyGroup>

    <ItemGroup>
        <PackageReference Include="DotNetJS" Version="*"/>
    </ItemGroup>

</Project>
```

To associate a JavaScript function with a C# method use `JSFunction` attribute. To expose a C# method to JavaScript, use `JSInvokable` attribute:

```csharp
using System;
using DotNetJS;
using Microsoft.JSInterop;

namespace HelloWorld;

partial class Program
{
    // Entry point is invoked by the JavaScript runtime on boot.
    void Main ()
    {
        // Invoking 'dotnet.HelloWorld.GetHostName()' JavaScript function.
        var hostName = GetHostName();
        // Writing to JavaScript host console.
        Console.WriteLine($"Hello {hostName}, DotNet here!");
    }
    
    [JSFunction] // The interoperability code is auto-generated.
    public static partial string GetHostName ();

    [JSInvokable] // The method is invoked from JavaScript.
    public static string GetName () => "DotNet";
}
```

Publish the project with `dotnet publish`. A single-file `dotnet.js` library will be produced under the "bin" directory. Consume the library depending on the environment:

### Browser

```html
<!-- Import as a global 'dotnet' object via script tag. -->
<script src="dotnet.js"></script>

<script>

    // Providing implementation for 'GetHostName' function declared in 'HelloWorld' C# assembly.
    dotnet.HelloWorld.GetHostName = () => "Browser";
    
    window.onload = async function () {
        // Booting the DotNet runtime and invoking entry point.
        await dotnet.boot();
        // Invoking 'GetName()' C# method defined in 'HelloWorld' assembly.
        const guestName = dotnet.HelloWorld.GetName();
        console.log(`Welcome, ${guestName}! Enjoy your global space.`);
    };
    
</script>
```

### Node.js

```js
// Import as CommonJS module.
const dotnet = require("dotnet");
// ... or as ECMAScript module in node v17 or later.
import dotnet from "dotnet.js";

// Providing implementation for 'GetHostName' function declared in 'HelloWorld' C# assembly.
dotnet.HelloWorld.GetHostName = () => "Node.js";

(async function () {
    // Booting the DotNet runtime and invoking entry point.
    await dotnet.boot();
    // Invoking 'GetName()' C# method defined in 'HelloWorld' assembly.
    const guestName = dotnet.HelloWorld.GetName();
    console.log(`Welcome, ${guestName}! Enjoy your module space.`);
})();
```

## Example Projects

Find the following sample projects in this repository:

 - [Hello World](https://github.com/Elringus/DotNetJS/tree/main/Samples/HelloWorld) — Consume the produced library as a global import in browser, CommonJS or ES module in node.
 - [Web Extension](https://github.com/Elringus/DotNetJS/tree/main/Samples/WebExtension) — Consume the library in VS Code web extension, which works in both web and standalone versions of the IDE.
 - [Runtime Tests](https://github.com/Elringus/DotNetJS/tree/main/JavaScript/dotnet-runtime/test) — Integration tests featuring various usage scenarios: async method invocations, interop with instances, sending raw byte arrays, streaming, etc.

## Build Properties

Specify following optional properties in .csproj to customize the build:

 - `<CleanPublish>false</CleanPublish>` — do not clean the build output folders.
 - `<EmitSourceMap>true</EmitSourceMap>` — emit JavaScript source map file.
 - `<EmitTypes>true</EmitTypes>` — emit TypeScript type definitions file.

For example, following configuration will preserve build artifacts and emit source map and type definitions files:

```xml
<Project Sdk="Microsoft.NET.Sdk.BlazorWebAssembly">

    <PropertyGroup>
        <TargetFramework>net6.0</TargetFramework>
        <CleanPublish>false</CleanPublish>
        <EmitSourceMap>true</EmitSourceMap>
        <EmitTypes>true</EmitTypes>
    </PropertyGroup>

    <ItemGroup>
        <PackageReference Include="DotNetJS" Version="*"/>
    </ItemGroup>

</Project>
```

## Compiling Runtime

To compile and test the runtime run the following in order (under [dotnet-runtime](https://github.com/Elringus/DotNetJS/tree/main/JavaScript/dotnet-runtime) folder):

```
scripts/install-emsdk.sh
scripts/compile-runtime.sh
npm build
scripts/compile-test.sh
npm test
```

## Publishing Runtime

A memo for the publishing process after modifying dotnet-runtime:

1. Bump NPM version on `JavaScript/dotnet-runtime/package.json` and:
 - `npm run build`
 - `scripts/publish-package.sh`
2. Bump NuGet version on `DotNet/DotNetJS/DotNetJS.csproj` and:
 - `dotnet pack -c Release --output bin`
 - `dotnet nuget push bin/DotNetJS.{VER}.nupkg --api-key {KEY} --source https://api.nuget.org/v3/index.json`
