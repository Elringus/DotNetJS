﻿using System.Collections.Generic;
using System.IO;

namespace DotNetJS.Packer
{
    public static class Utilities
    {
        public static IEnumerable<string> SplitLines (string input)
        {
            var line = default(string);
            using (var reader = new StringReader(input))
                while ((line = reader.ReadLine()) != null)
                    yield return line;
        }

        public static string JoinLines (IEnumerable<string> values, int indent = 1)
        {
            var separator = "\n" + new string(' ', indent * 4);
            return string.Join(separator, values);
        }

        public static string JoinLines (params string[] values) => JoinLines(values, 1);

        public static string JoinLines (int indent, params string[] values) => JoinLines(values, indent);
    }
}