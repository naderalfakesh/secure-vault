#!/usr/bin/env python3
"""Patch LC_BUILD_VERSION platform in arm64 slices of fat static frameworks.

Usage: patch_platform.py <file> <new_platform_int>
Handles: fat binaries, ar archives inside slices, single Mach-O objects.
Only touches arm64 (cputype 0x0100000C) slices. Patches in place.
"""
import struct, sys

FAT_MAGIC = 0xCAFEBABE
MH_MAGIC_64 = 0xFEEDFACF
LC_BUILD_VERSION = 0x32
CPU_ARM64 = 0x0100000C

def patch_macho(buf, off, new_platform):
    """new_platform > 0: rewrite platform field. new_platform == 0: remove the
    LC_BUILD_VERSION command entirely (platform-agnostic object)."""
    magic = struct.unpack_from("<I", buf, off)[0]
    if magic != MH_MAGIC_64:
        return 0
    ncmds, sizeofcmds = struct.unpack_from("<II", buf, off + 16)
    lc_off = off + 32
    n = 0
    remaining = ncmds
    while remaining > 0:
        cmd, cmdsize = struct.unpack_from("<II", buf, lc_off)
        if cmd == LC_BUILD_VERSION:
            if new_platform:
                struct.pack_into("<I", buf, lc_off + 8, new_platform)
                lc_off += cmdsize
            else:
                # shift the rest of the load-command area down over this cmd
                lc_end = off + 32 + sizeofcmds
                buf[lc_off:lc_end - cmdsize] = buf[lc_off + cmdsize:lc_end]
                buf[lc_end - cmdsize:lc_end] = b"\x00" * cmdsize
                ncmds -= 1
                sizeofcmds -= cmdsize
                struct.pack_into("<II", buf, off + 16, ncmds, sizeofcmds)
            n += 1
        else:
            lc_off += cmdsize
        remaining -= 1
    return n

def patch_archive(buf, start, size, new_platform):
    # ar archive: global header "!<arch>\n" then members
    assert buf[start:start+8] == b"!<arch>\n", "not an archive"
    pos = start + 8
    end = start + size
    n = 0
    while pos + 60 <= end:
        hdr = buf[pos:pos+60]
        if hdr[58:60] != b"\x60\x0a":
            break
        name = hdr[0:16].decode("ascii", "replace").strip()
        msize = int(hdr[48:58].decode().strip())
        data_off = pos + 60
        ext = 0
        if name.startswith("#1/"):
            ext = int(name[3:])
            data_off += ext
        member_size = msize - ext
        if member_size >= 4:
            magic = struct.unpack_from("<I", buf, data_off)[0]
            if magic == MH_MAGIC_64:
                n += patch_macho(buf, data_off, new_platform)
        pos += 60 + msize
        if pos % 2:
            pos += 1
    return n

def main():
    path, plat = sys.argv[1], int(sys.argv[2])
    with open(path, "rb") as f:
        buf = bytearray(f.read())
    total = 0
    magic_be = struct.unpack_from(">I", buf, 0)[0]
    if magic_be == FAT_MAGIC:
        nfat = struct.unpack_from(">I", buf, 4)[0]
        for i in range(nfat):
            cputype, cpusub, offset, size, align = struct.unpack_from(">iiIII", buf, 8 + i*20)
            if cputype != CPU_ARM64:
                continue
            if buf[offset:offset+8] == b"!<arch>\n":
                total += patch_archive(buf, offset, size, plat)
            else:
                total += patch_macho(buf, offset, plat)
    elif buf[0:8] == b"!<arch>\n":
        total += patch_archive(buf, 0, len(buf), plat)
    else:
        total += patch_macho(buf, 0, plat)
    with open(path, "wb") as f:
        f.write(buf)
    print(f"{path}: patched {total} LC_BUILD_VERSION command(s) -> platform {plat}")

if __name__ == "__main__":
    main()
