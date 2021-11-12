﻿// Based on https://github.com/dotnet/aspnetcore/blob/release/6.0/src/Components/Web.JS/src/Platform/Mono/MonoPlatform.ts

import { DotNet } from "dotnet-js-interop";
import { assertHeapNotLocked, currentHeapLock } from "./heap-lock";
import { wasm } from "./wasm";

const uint64HighOrderShift = Math.pow(2, 32);
const maxSafeNumberHighPart = Math.pow(2, 21) - 1;

let invokeDotNet;
let beginInvokeDotNet;
let endInvokeJS;
let notifyByteArrayAvailable;
let transferredArray: Uint8Array | null = null;

export function initializeInterop(): void {
    bindMethods();
    DotNet.attachDispatcher(createDispatcher());
    assignBlazorGlobals();
}

export const invoke: <T>(assembly: string, method: string, ...args: any[]) => T = DotNet.invokeMethod;

export const invokeAsync: <T>(assembly: string, method: string, ...args: any[]) => Promise<T> = DotNet.invokeMethodAsync;

function bindMethods(): void {
    invokeDotNet = bindStaticMethod("Microsoft.AspNetCore.Components.WebAssembly",
        "Microsoft.AspNetCore.Components.WebAssembly.Services.DefaultWebAssemblyJSRuntime", "InvokeDotNet");
    beginInvokeDotNet = bindStaticMethod("Microsoft.AspNetCore.Components.WebAssembly",
        "Microsoft.AspNetCore.Components.WebAssembly.Services.DefaultWebAssemblyJSRuntime", "BeginInvokeDotNet");
    endInvokeJS = bindStaticMethod("Microsoft.AspNetCore.Components.WebAssembly",
        "Microsoft.AspNetCore.Components.WebAssembly.Services.DefaultWebAssemblyJSRuntime", "EndInvokeJS");
    notifyByteArrayAvailable = bindStaticMethod("Microsoft.AspNetCore.Components.WebAssembly",
        "Microsoft.AspNetCore.Components.WebAssembly.Services.DefaultWebAssemblyJSRuntime", "NotifyByteArrayAvailable");
}

function createDispatcher(): DotNet.DotNetCallDispatcher {
    return {
        invokeDotNetFromJS: invokeDotNetFromJS,
        beginInvokeDotNetFromJS: beginInvokeDotNetFromJS,
        endInvokeJSFromDotNet: endInvokeJSFromDotNet,
        sendByteArray: sendByteArray
    };
}

function assignBlazorGlobals(): void {
    // "Blazor" global is hardcoded in mono wasm runtime. ¯\_(ツ)_/¯
    // https://github.com/dotnet/runtime/blob/release/6.0/src/mono/wasm/runtime/dotnet_support.js#L15
    global["Blazor"] = {
        _internal: {
            invokeJSFromDotNet: invokeJSFromDotNet,
            endInvokeDotNetFromJS: endInvokeDotNetFromJS,
            receiveByteArray: receiveByteArray,
            retrieveByteArray: retrieveByteArray,
            dotNetCriticalError: logDotNetError
        }
    };
}

function bindStaticMethod(assembly: string, typeName: string, method: string) {
    const fqn = `[${assembly}] ${typeName}:${method}`;
    return wasm.BINDING.bind_static_method(fqn);
}

function invokeJSFromDotNet(callInfo, arg0, arg1, arg2): any {
    const functionId = readHeapObject(callInfo, 0)!;
    const resultType = readHeapInt32(callInfo, 4);
    const callArgs = readHeapObject(callInfo, 8);
    const targetId = readHeapUint64(callInfo, 20);

    if (callArgs !== null) {
        const callHandle = readHeapUint64(callInfo, 12);
        if (callHandle !== 0) {
            DotNet.jsCallDispatcher.beginInvokeJSFromDotNet(callHandle, functionId, callArgs, resultType, targetId);
            return 0;
        } else {
            const resultJson = DotNet.jsCallDispatcher.invokeJSFromDotNet(functionId, callArgs, resultType, targetId)!;
            return resultJson === null ? 0 : wasm.BINDING.js_string_to_mono_string(resultJson);
        }
    }

    const func = DotNet.jsCallDispatcher.findJSFunction(functionId, targetId);
    const result = func.call(null, arg0, arg1, arg2);

    switch (resultType) {
        case DotNet.JSCallResultType.Default:
            return result;
        case DotNet.JSCallResultType.JSObjectReference:
            return DotNet.createJSObjectReference(result).__jsObjectId;
        case DotNet.JSCallResultType.JSStreamReference:
            const streamReference = DotNet.createJSStreamReference(result);
            const resultJson = JSON.stringify(streamReference);
            return wasm.BINDING.js_string_to_mono_string(resultJson);
        case DotNet.JSCallResultType.JSVoidResult:
            return null;
        default:
            throw new Error(`Invalid JS call result type '${resultType}'.`);
    }
}

function invokeDotNetFromJS(assemblyName, methodIdentifier, dotNetObjectId, argsJson): string {
    assertHeapNotLocked();
    const assemblyNameOrNull = assemblyName ? assemblyName : null;
    const objectIdOrNull = dotNetObjectId ? dotNetObjectId.toString() : null;
    return invokeDotNet(assemblyNameOrNull, methodIdentifier, objectIdOrNull, argsJson) as string;
}

function beginInvokeDotNetFromJS(callId, assemblyName, methodIdentifier, dotNetObjectId, argsJson) {
    assertHeapNotLocked();
    if (!dotNetObjectId && !assemblyName)
        throw new Error("Either assemblyName or dotNetObjectId must have a non null value.");
    const assemblyNameOrObjectId: string = dotNetObjectId ? dotNetObjectId.toString() : assemblyName;
    beginInvokeDotNet(callId ? callId.toString() : null, assemblyNameOrObjectId, methodIdentifier, argsJson);
}

function endInvokeDotNetFromJS(callId, success, resultJsonOrErrorMessage): void {
    const callIdString = wasm.BINDING.conv_string(callId)!;
    const successBool = (success as any as number) !== 0;
    const resultJsonOrErrorMessageString = wasm.BINDING.conv_string(resultJsonOrErrorMessage)!;
    DotNet.jsCallDispatcher.endInvokeDotNetFromJS(callIdString, successBool, resultJsonOrErrorMessageString);
}

function endInvokeJSFromDotNet(asyncHandle, succeeded, serializedArgs): void {
    endInvokeJS(serializedArgs);
}

function receiveByteArray(id, data): void {
    const idLong = id as any as number;
    const dataByteArray = toUint8Array(data);
    DotNet.jsCallDispatcher.receiveByteArray(idLong, dataByteArray);
}

function retrieveByteArray() {
    if (transferredArray === null)
        throw new Error("Byte array not available for transfer");
    return wasm.BINDING.js_typed_array_to_array(transferredArray);
}

function sendByteArray(id: number, data: Uint8Array): void {
    transferredArray = data;
    notifyByteArrayAvailable(id);
}

function toUint8Array(array): Uint8Array {
    const dataPtr = getArrayDataPointer(array);
    const length = getValueI32(dataPtr);
    const uint8Array = new Uint8Array(length);
    uint8Array.set(wasm.HEAPU8.subarray(dataPtr + 4, dataPtr + 4 + length));
    return uint8Array;
}

function readHeapObject(baseAddress, fieldOffset?, readBoolValueAsString?) {
    const fieldValue = getValueI32((baseAddress as any as number) + (fieldOffset || 0)) as any;
    if (fieldValue === 0) return null;
    if (readBoolValueAsString) {
        const unboxedValue = wasm.BINDING.unbox_mono_obj(fieldValue);
        if (typeof (unboxedValue) === "boolean") return unboxedValue ? "" : null;
        return unboxedValue;
    }
    return decodeString(fieldValue);
}

function decodeString(fieldValue) {
    let decodedString: string | null | undefined;
    if (currentHeapLock) {
        decodedString = currentHeapLock.stringCache.get(fieldValue);
        if (decodedString === undefined) {
            decodedString = wasm.BINDING.conv_string(fieldValue);
            currentHeapLock.stringCache.set(fieldValue, decodedString as any);
        }
    } else decodedString = wasm.BINDING.conv_string(fieldValue);
    return decodedString;
}

function getValueI32(ptr: number) {
    return wasm.HEAP32[ptr >> 2];
}

function getValueU64(ptr: number) {
    const heapU32Index = ptr >> 2;
    const highPart = wasm.HEAPU32[heapU32Index + 1];
    if (highPart > maxSafeNumberHighPart)
        throw new Error(`Cannot read uint64 with ES order part ${highPart}, because the result would exceed Number.MAX_SAFE_INTEGER.`);
    return (highPart * uint64HighOrderShift) + wasm.HEAPU32[heapU32Index];
}

function readHeapInt32(baseAddress, fieldOffset?): number {
    return getValueI32((baseAddress as any as number) + (fieldOffset || 0));
}

function readHeapUint64(baseAddress, fieldOffset?): number {
    return getValueU64((baseAddress as any as number) + (fieldOffset || 0));
}

function getArrayDataPointer<T>(array): number {
    return <number><any>array + 12;
}

function logDotNetError(error): void {
    const message = wasm.BINDING.conv_string(error);
    console.error(message);
}