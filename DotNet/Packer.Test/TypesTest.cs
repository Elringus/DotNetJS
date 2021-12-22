﻿using System;
using System.IO;
using System.Linq;
using Xunit;

namespace Packer.Test;

public sealed class TypesTest : BuildTest
{
    public TypesTest () => Task.EmitTypes = true;

    [Fact]
    public void WhenTypeResolveFailsExceptionIsThrown ()
    {
        File.Delete(Path.Combine(Data.JSDir, "interop.d.ts"));
        Assert.Throws<PackerException>(() => Task.Execute());
    }

    [Fact]
    public void TypesContainInteropAndBootContentWithoutImport ()
    {
        Task.Execute();
        Contains(MockData.InteropTypeContent);
        Contains(MockData.BootTypeContent.Split('\n')[1]);
    }

    [Fact]
    public void TypesDontContainOtherContent ()
    {
        File.WriteAllText(Path.Combine(Data.JSDir, "other.d.ts"), "other");
        Task.Execute();
        Assert.DoesNotContain("other", Data.GeneratedTypes);
    }

    [Fact]
    public void LibraryExportsAssemblyObject ()
    {
        Data.AddAssemblyWithName("foo.dll", "[JSInvokable] public static void Bar () { }");
        Task.Execute();
        Contains("export declare const foo: {");
    }

    [Fact]
    public void WhenAssemblyNameContainDotsObjectCreatedForEachPart ()
    {
        Data.AddAssemblyWithName("foo.bar.nya.dll", "[JSInvokable] public static void Bar () { }");
        Task.Execute();
        Contains("export declare const foo: { bar: { nya: {");
    }

    [Fact]
    public void BindingsFromMultipleAssembliesAssignedToRespectiveObjects ()
    {
        Data.AddAssemblyWithName("foo.dll", "[JSInvokable] public static void Foo () { }");
        Data.AddAssemblyWithName("bar.nya.dll", "[JSFunction] public static void Fun () { }");
        Task.Execute();
        Contains("export declare const bar: { nya: {\n    Fun: () => void,\n};};");
        Contains("export declare const foo: {\n    Foo: () => void,\n};");
    }

    [Fact]
    public void MultipleAssemblyObjectsDeclaredFromNewLine ()
    {
        Data.AddAssemblyWithName("a.dll", "[JSInvokable] public static void Foo () { }");
        Data.AddAssemblyWithName("b.dll", "[JSInvokable] public static void Bar () { }");
        Task.Execute();
        Contains("\nexport declare const b");
    }

    [Fact]
    public void NumericsTranslatedToNumber ()
    {
        var nums = new[] { "byte", "sbyte", "ushort", "uint", "ulong", "short", "int", "long", "decimal", "double", "float" };
        var csArgs = string.Join(", ", nums.Select(n => n + " v" + Array.IndexOf(nums, n)));
        var tsArgs = string.Join(", ", nums.Select(n => "v" + Array.IndexOf(nums, n) + ": number"));
        Data.AddAssembly($"[JSInvokable] public static void Num ({csArgs}) {{}}");
        Task.Execute();
        Contains($"Num: ({tsArgs})");
    }

    [Fact]
    public void TaskTranslatedToPromise ()
    {
        Data.AddAssembly(
            "[JSInvokable] public static Task<bool> AsyBool () => default;",
            "[JSInvokable] public static ValueTask AsyVoid () => default;"
        );
        Task.Execute();
        Contains("AsyBool: () => Promise<boolean>");
        Contains("AsyVoid: () => Promise<void>");
    }

    [Fact]
    public void CharAndStringTranslatedToString ()
    {
        Data.AddAssembly("[JSInvokable] public static void Cha (char c, string s) {}");
        Task.Execute();
        Contains("Cha: (c: string, s: string) => void");
    }

    [Fact]
    public void BoolTranslatedToBoolean ()
    {
        Data.AddAssembly("[JSInvokable] public static void Boo (bool b) {}");
        Task.Execute();
        Contains("Boo: (b: boolean) => void");
    }

    [Fact]
    public void DateTimeTranslatedToDate ()
    {
        Data.AddAssembly("[JSInvokable] public static void Doo (DateTime time) {}");
        Task.Execute();
        Contains("Doo: (time: Date) => void");
    }

    [Fact]
    public void OtherTypesTranslatedToAny ()
    {
        Data.AddAssembly("[JSInvokable] public static Type Method (Type t) => default;");
        Task.Execute();
        Contains("Method: (t: any) => any");
    }

    private void Contains (string content) => Assert.Contains(content, Data.GeneratedTypes);
}
