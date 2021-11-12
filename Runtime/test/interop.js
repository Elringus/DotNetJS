﻿const assert = require("assert");
const dotnet = require("../dist/dotnet");
const { bootTest } = require("./project");

const invoke = (name, ...args) => dotnet.invoke("Test", name, ...args);
const invokeAsync = (name, ...args) => dotnet.invokeAsync("Test", name, ...args);

describe("interop", () => {
    before(bootTest);
    after(dotnet.terminate);
    it("throws when assembly is not found", () => {
        assert.throws(() => dotnet.invoke("Foo", "JoinStrings"), /.*no loaded assembly.*'Foo'/);
    });
    it("throws when method is not found", () => {
        assert.throws(() => invoke("Bar"), /.*does not contain.*"Bar"/);
    });
    it("can send and receive string", () => {
        assert.deepStrictEqual(invoke("JoinStrings", "foo", "bar"), "foobar");
    });
    it("can send and receive number", () => {
        assert.deepStrictEqual(invoke("SumDoubles", -1, 2.75), 1.75);
    });
    it("can send and receive object", () => {
        const date = new Date(1977, 3, 2);
        const expected = new Date(1977, 3, 9);
        const actual = new Date(invoke("AddDays", date, 7));
        assert.deepStrictEqual(actual, expected);
    });
    it("can invoke js function from dotnet", () => {
        let invokedFromDotNet = false;
        global.invokeFromDotNet = () => invokedFromDotNet = true;
        invoke("InvokeJS", "invokeFromDotNet");
        assert(invokedFromDotNet);
    });
    it("can process array with a js callback", () => {
        const array = ["a", "b", "c"];
        const expected = ["aa", "bb", "cc"];
        global.repeat = item => item + item;
        const actual = invoke("ForEachJS", array, "repeat");
        assert.deepStrictEqual(actual, expected);
    });
    it("can interop with async methods", async () => {
        assert.deepStrictEqual(await invokeAsync("JoinStringsAsync", "a", "b"), "ab");
    });
    it("can find method by alias", () => {
        assert.deepStrictEqual(invoke("EchoAlias", "foo"), "foo");
    });
    it("can interop with instance", () => {
        const instance = invoke("CreateInstance");
        assert.doesNotThrow(() => instance.invokeMethod("SetVar", "foo"));
        assert.deepStrictEqual(instance.invokeMethod("GetVar"), "foo");
        assert.doesNotThrow(() => instance.dispose());
    });
    it("can send instance to dotnet", () => {
        const instance1 = invoke("CreateInstance");
        const instance2 = invoke("CreateInstance");
        instance1.invokeMethod("SetVar", "bar");
        instance2.invokeMethod("SetFromOther", instance1);
        assert.deepStrictEqual(instance2.invokeMethod("GetVar"), "bar");
        instance1.dispose();
        instance2.dispose();
    });
    it("can send and receive raw bytes", () => {
        global.receiveBytes = bytes => new TextDecoder().decode(bytes);
        const bytes = new Uint8Array([0x45, 0x76, 0x65, 0x72, 0x79, 0x74, 0x68, 0x69,
            0x6e, 0x67, 0x27, 0x73, 0x20, 0x73, 0x68, 0x69, 0x6e, 0x79, 0x2c,
            0x20, 0x43, 0x61, 0x70, 0x74, 0x61, 0x69, 0x6e, 0x2e, 0x20, 0x4e,
            0x6f, 0x74, 0x20, 0x74, 0x6f, 0x20, 0x66, 0x72, 0x65, 0x74, 0x2e]);
        const expected = "Everything's shiny, Captain. Not to fret.";
        assert.deepStrictEqual(invoke("ReceiveBytes", bytes), expected);
        assert.deepStrictEqual(invoke("SendBytes"), expected);
    });
    it("can catch js exceptions", () => {
        global.throw = function () {
            throw new Error("foo");
        };
        assert.deepStrictEqual(invoke("CatchException").split("\n")[0], "foo");
    });
    it("can catch dotnet exceptions", () => {
        assert.throws(() => invoke("Throw", "bar"), /Error: System.Exception: bar/);
    });
    // TODO: Figure how to test async streaming without blocking the thread.
    // it("can stream", async () => {
    //     let received, resolve;
    //     global.sendStream = () => new Uint8Array(10000000);
    //     global.receiveStream = async ref => {
    //         received = await ref.arrayBuffer();
    //         resolve();
    //     };
    //     invoke("StartStream");
    //     await new Promise(r => resolve = r);
    //     assert.deepStrictEqual(received.length, 10000000);
    // });
    // TODO: Test unmarshalled interop.
    // https://docs.microsoft.com/en-us/aspnet/core/blazor/javascript-interoperability/call-javascript-from-dotnet#unmarshalled-javascript-interop
});