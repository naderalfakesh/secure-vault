#!/usr/bin/env python3
"""Backport the Swift 6.4 .swiftinterface strip to expo-modules-jsi 57.

Usage: jsi-interface-patch.py <expo-modules-jsi/apple directory>
Prints "patched" when it changed the build script, "ok" when nothing was
needed. After a change the caller clears the package's slice caches, because
their hashes cover the sources but not this script.
"""
import sys
from pathlib import Path

# expo-modules-jsi 57.1.2 only strips "extension __ObjC.expo.CppError"; Swift 6.4
# prints it with module selectors ("extension __ObjC::expo.__ObjC::CppError")
# plus "@available(*, unavailable)" lines. The replacement is SDK 58's line
# (expo/expo#50569 and #51234).
OLD = r"""sed '/^extension __ObjC\./,/^}/d;/^@usableFromInline$/{N;/_ConstraintThatIsNotPartOfTheAPIOfThisLibrary/d;};/_ConstraintThatIsNotPartOfTheAPIOfThisLibrary/d' "$swiftinterface" > "$stripped_swiftinterface" """.rstrip()
NEW = r"""sed -E '/^extension __ObjC(\.|::)/,/^}/d;/^@usableFromInline$/{N;/_ConstraintThatIsNotPartOfTheAPIOfThisLibrary/d;};/^@available\(\*, unavailable\)$/{N;/_ConstraintThatIsNotPartOfTheAPIOfThisLibrary/d;};/_ConstraintThatIsNotPartOfTheAPIOfThisLibrary/d' "$swiftinterface" > "$stripped_swiftinterface" """.rstrip()

script = Path(sys.argv[1]) / "scripts" / "build-xcframework.sh"
text = script.read_text()
if OLD in text:
    script.write_text(text.replace(OLD, NEW))
    print("patched")
elif NEW in text or "__ObjC(\\.|::)" in text:
    print("ok")
else:
    sys.exit(f"{script}: strip command not found; check the Swift 6.4 fix is still needed")
