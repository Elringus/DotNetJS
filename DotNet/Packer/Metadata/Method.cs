﻿using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Threading.Tasks;

namespace DotNetJS.Packer
{
    public class Method
    {
        public string Name { get; }
        public string Assembly { get; }
        public IReadOnlyList<Argument> Arguments { get; }
        public string ReturnType { get; }
        public bool Async { get; }

        public Method (MethodInfo info)
        {
            Name = info.Name;
            Assembly = GetAssemblyName(info);
            Arguments = GetArguments(info);
            ReturnType = TypeConversion.ToTypeScript(info.ReturnType);
            Async = info.ReturnType.GetMethod(nameof(Task.GetAwaiter)) != null;
        }

        private string GetAssemblyName (MemberInfo member)
        {
            if (member.DeclaringType is null)
                throw new PackerException($"Failed to get declaring type for '{member}'.");
            return member.DeclaringType.Assembly.GetName().Name;
        }

        private Argument[] GetArguments (MethodInfo info)
        {
            return info.GetParameters().Select(p => new Argument(p)).ToArray();
        }
    }
}