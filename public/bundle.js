// packages/elm-wasm/src/assets.js
var ASSET_FILES = {
  wasm: "ulm.wasm",
  elmInit: "elm-init.tar.gz",
  artifacts: "elm-all-examples-package-artifacts.tar.gz",
  moduleIndex: "elm-modules-index.json"
};
var NODE_FS = ["node", "fs/promises"].join(":");
var toBytes = (value) => value instanceof Uint8Array ? value : new Uint8Array(value);
async function readBytes(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  } catch (err) {
    if (typeof url === "string" && url.startsWith("file:")) {
      try {
        const { readFile } = await import(
          /* @vite-ignore */
          NODE_FS
        );
        return new Uint8Array(await readFile(new URL(url)));
      } catch {
      }
    }
    throw err;
  }
}
var bytesFromUrl = readBytes;
function moduleUrl() {
  try {
    return typeof import.meta !== "undefined" ? import.meta.url : void 0;
  } catch {
    return void 0;
  }
}
function resolveBaseUrl(baseUrl) {
  const base = baseUrl ?? "./";
  const fromModule = moduleUrl();
  if (fromModule) return new URL(base, fromModule).href;
  const fallback = typeof document !== "undefined" && document.baseURI || typeof location !== "undefined" && location.href || void 0;
  if (!fallback) {
    throw new Error("Cannot resolve the asset base URL \u2014 pass an absolute `baseUrl`.");
  }
  return new URL(base, fallback).href;
}
function assetUrl(name, { baseUrl, explicit } = {}) {
  if (explicit) return new URL(explicit, resolveBaseUrl(baseUrl)).href;
  return new URL(name, resolveBaseUrl(baseUrl)).href;
}
async function loadAssets(options = {}) {
  const pick = (bytes, explicit, name, required = true) => {
    if (bytes) return Promise.resolve(toBytes(bytes));
    if (!explicit && !required) {
      return bytesFromUrl(assetUrl(name, { baseUrl: options.baseUrl })).catch(() => null);
    }
    return bytesFromUrl(assetUrl(name, { baseUrl: options.baseUrl, explicit }));
  };
  const [wasmBytes, elmInitTarGz, artifactsTarGz] = await Promise.all([
    pick(options.wasmBytes, options.wasmUrl, ASSET_FILES.wasm),
    pick(options.elmInitBytes, options.elmInitUrl, ASSET_FILES.elmInit, false),
    pick(options.artifactsBytes, options.artifactsUrl, ASSET_FILES.artifacts, false)
  ]);
  return { wasmBytes, elmInitTarGz, artifactsTarGz };
}
async function loadModuleIndex(options = {}) {
  if (options.moduleIndex) return options.moduleIndex;
  try {
    const bytes = await readBytes(assetUrl(ASSET_FILES.moduleIndex, { baseUrl: options.baseUrl }));
    const json = JSON.parse(new TextDecoder().decode(bytes));
    return json?.modules ?? null;
  } catch {
    return null;
  }
}

// node_modules/@bjorn3/browser_wasi_shim/dist/wasi_defs.js
var CLOCKID_REALTIME = 0;
var CLOCKID_MONOTONIC = 1;
var ERRNO_SUCCESS = 0;
var ERRNO_BADF = 8;
var ERRNO_EXIST = 20;
var ERRNO_INVAL = 28;
var ERRNO_ISDIR = 31;
var ERRNO_NAMETOOLONG = 37;
var ERRNO_NOENT = 44;
var ERRNO_NOSYS = 52;
var ERRNO_NOTDIR = 54;
var ERRNO_NOTEMPTY = 55;
var ERRNO_NOTSUP = 58;
var ERRNO_PERM = 63;
var ERRNO_NOTCAPABLE = 76;
var RIGHTS_FD_DATASYNC = 1 << 0;
var RIGHTS_FD_READ = 1 << 1;
var RIGHTS_FD_SEEK = 1 << 2;
var RIGHTS_FD_FDSTAT_SET_FLAGS = 1 << 3;
var RIGHTS_FD_SYNC = 1 << 4;
var RIGHTS_FD_TELL = 1 << 5;
var RIGHTS_FD_WRITE = 1 << 6;
var RIGHTS_FD_ADVISE = 1 << 7;
var RIGHTS_FD_ALLOCATE = 1 << 8;
var RIGHTS_PATH_CREATE_DIRECTORY = 1 << 9;
var RIGHTS_PATH_CREATE_FILE = 1 << 10;
var RIGHTS_PATH_LINK_SOURCE = 1 << 11;
var RIGHTS_PATH_LINK_TARGET = 1 << 12;
var RIGHTS_PATH_OPEN = 1 << 13;
var RIGHTS_FD_READDIR = 1 << 14;
var RIGHTS_PATH_READLINK = 1 << 15;
var RIGHTS_PATH_RENAME_SOURCE = 1 << 16;
var RIGHTS_PATH_RENAME_TARGET = 1 << 17;
var RIGHTS_PATH_FILESTAT_GET = 1 << 18;
var RIGHTS_PATH_FILESTAT_SET_SIZE = 1 << 19;
var RIGHTS_PATH_FILESTAT_SET_TIMES = 1 << 20;
var RIGHTS_FD_FILESTAT_GET = 1 << 21;
var RIGHTS_FD_FILESTAT_SET_SIZE = 1 << 22;
var RIGHTS_FD_FILESTAT_SET_TIMES = 1 << 23;
var RIGHTS_PATH_SYMLINK = 1 << 24;
var RIGHTS_PATH_REMOVE_DIRECTORY = 1 << 25;
var RIGHTS_PATH_UNLINK_FILE = 1 << 26;
var RIGHTS_POLL_FD_READWRITE = 1 << 27;
var RIGHTS_SOCK_SHUTDOWN = 1 << 28;
var Iovec = class _Iovec {
  static read_bytes(view, ptr) {
    const iovec = new _Iovec();
    iovec.buf = view.getUint32(ptr, true);
    iovec.buf_len = view.getUint32(ptr + 4, true);
    return iovec;
  }
  static read_bytes_array(view, ptr, len) {
    const iovecs = [];
    for (let i = 0; i < len; i++) {
      iovecs.push(_Iovec.read_bytes(view, ptr + 8 * i));
    }
    return iovecs;
  }
};
var Ciovec = class _Ciovec {
  static read_bytes(view, ptr) {
    const iovec = new _Ciovec();
    iovec.buf = view.getUint32(ptr, true);
    iovec.buf_len = view.getUint32(ptr + 4, true);
    return iovec;
  }
  static read_bytes_array(view, ptr, len) {
    const iovecs = [];
    for (let i = 0; i < len; i++) {
      iovecs.push(_Ciovec.read_bytes(view, ptr + 8 * i));
    }
    return iovecs;
  }
};
var WHENCE_SET = 0;
var WHENCE_CUR = 1;
var WHENCE_END = 2;
var FILETYPE_CHARACTER_DEVICE = 2;
var FILETYPE_DIRECTORY = 3;
var FILETYPE_REGULAR_FILE = 4;
var Dirent = class {
  head_length() {
    return 24;
  }
  name_length() {
    return this.dir_name.byteLength;
  }
  write_head_bytes(view, ptr) {
    view.setBigUint64(ptr, this.d_next, true);
    view.setBigUint64(ptr + 8, this.d_ino, true);
    view.setUint32(ptr + 16, this.dir_name.length, true);
    view.setUint8(ptr + 20, this.d_type);
  }
  write_name_bytes(view8, ptr, buf_len) {
    view8.set(this.dir_name.slice(0, Math.min(this.dir_name.byteLength, buf_len)), ptr);
  }
  constructor(next_cookie, d_ino, name, type) {
    const encoded_name = new TextEncoder().encode(name);
    this.d_next = next_cookie;
    this.d_ino = d_ino;
    this.d_namlen = encoded_name.byteLength;
    this.d_type = type;
    this.dir_name = encoded_name;
  }
};
var FDFLAGS_APPEND = 1 << 0;
var FDFLAGS_DSYNC = 1 << 1;
var FDFLAGS_NONBLOCK = 1 << 2;
var FDFLAGS_RSYNC = 1 << 3;
var FDFLAGS_SYNC = 1 << 4;
var Fdstat = class {
  write_bytes(view, ptr) {
    view.setUint8(ptr, this.fs_filetype);
    view.setUint16(ptr + 2, this.fs_flags, true);
    view.setBigUint64(ptr + 8, this.fs_rights_base, true);
    view.setBigUint64(ptr + 16, this.fs_rights_inherited, true);
  }
  constructor(filetype, flags) {
    this.fs_rights_base = 0n;
    this.fs_rights_inherited = 0n;
    this.fs_filetype = filetype;
    this.fs_flags = flags;
  }
};
var FSTFLAGS_ATIM = 1 << 0;
var FSTFLAGS_ATIM_NOW = 1 << 1;
var FSTFLAGS_MTIM = 1 << 2;
var FSTFLAGS_MTIM_NOW = 1 << 3;
var OFLAGS_CREAT = 1 << 0;
var OFLAGS_DIRECTORY = 1 << 1;
var OFLAGS_EXCL = 1 << 2;
var OFLAGS_TRUNC = 1 << 3;
var Filestat = class {
  write_bytes(view, ptr) {
    view.setBigUint64(ptr, this.dev, true);
    view.setBigUint64(ptr + 8, this.ino, true);
    view.setUint8(ptr + 16, this.filetype);
    view.setBigUint64(ptr + 24, this.nlink, true);
    view.setBigUint64(ptr + 32, this.size, true);
    view.setBigUint64(ptr + 38, this.atim, true);
    view.setBigUint64(ptr + 46, this.mtim, true);
    view.setBigUint64(ptr + 52, this.ctim, true);
  }
  constructor(ino, filetype, size) {
    this.dev = 0n;
    this.nlink = 0n;
    this.atim = 0n;
    this.mtim = 0n;
    this.ctim = 0n;
    this.ino = ino;
    this.filetype = filetype;
    this.size = size;
  }
};
var EVENTTYPE_CLOCK = 0;
var EVENTRWFLAGS_FD_READWRITE_HANGUP = 1 << 0;
var SUBCLOCKFLAGS_SUBSCRIPTION_CLOCK_ABSTIME = 1 << 0;
var Subscription = class _Subscription {
  static read_bytes(view, ptr) {
    return new _Subscription(view.getBigUint64(ptr, true), view.getUint8(ptr + 8), view.getUint32(ptr + 16, true), view.getBigUint64(ptr + 24, true), view.getUint16(ptr + 36, true));
  }
  constructor(userdata, eventtype, clockid, timeout, flags) {
    this.userdata = userdata;
    this.eventtype = eventtype;
    this.clockid = clockid;
    this.timeout = timeout;
    this.flags = flags;
  }
};
var Event = class {
  write_bytes(view, ptr) {
    view.setBigUint64(ptr, this.userdata, true);
    view.setUint16(ptr + 8, this.error, true);
    view.setUint8(ptr + 10, this.eventtype);
  }
  constructor(userdata, error, eventtype) {
    this.userdata = userdata;
    this.error = error;
    this.eventtype = eventtype;
  }
};
var RIFLAGS_RECV_PEEK = 1 << 0;
var RIFLAGS_RECV_WAITALL = 1 << 1;
var ROFLAGS_RECV_DATA_TRUNCATED = 1 << 0;
var SDFLAGS_RD = 1 << 0;
var SDFLAGS_WR = 1 << 1;
var PREOPENTYPE_DIR = 0;
var PrestatDir = class {
  write_bytes(view, ptr) {
    view.setUint32(ptr, this.pr_name.byteLength, true);
  }
  constructor(name) {
    this.pr_name = new TextEncoder().encode(name);
  }
};
var Prestat = class _Prestat {
  static dir(name) {
    const prestat = new _Prestat();
    prestat.tag = PREOPENTYPE_DIR;
    prestat.inner = new PrestatDir(name);
    return prestat;
  }
  write_bytes(view, ptr) {
    view.setUint32(ptr, this.tag, true);
    this.inner.write_bytes(view, ptr + 4);
  }
};

// node_modules/@bjorn3/browser_wasi_shim/dist/debug.js
var Debug = class Debug2 {
  enable(enabled) {
    this.log = createLogger(enabled === void 0 ? true : enabled, this.prefix);
  }
  get enabled() {
    return this.isEnabled;
  }
  constructor(isEnabled) {
    this.isEnabled = isEnabled;
    this.prefix = "wasi:";
    this.enable(isEnabled);
  }
};
function createLogger(enabled, prefix) {
  if (enabled) {
    const a = console.log.bind(console, "%c%s", "color: #265BA0", prefix);
    return a;
  } else {
    return () => {
    };
  }
}
var debug = new Debug(false);

// node_modules/@bjorn3/browser_wasi_shim/dist/wasi.js
var WASIProcExit = class extends Error {
  constructor(code) {
    super("exit with exit code " + code);
    this.code = code;
  }
};
var WASI = class WASI2 {
  start(instance) {
    this.inst = instance;
    try {
      instance.exports._start();
      return 0;
    } catch (e) {
      if (e instanceof WASIProcExit) {
        return e.code;
      } else {
        throw e;
      }
    }
  }
  initialize(instance) {
    this.inst = instance;
    if (instance.exports._initialize) {
      instance.exports._initialize();
    }
  }
  constructor(args, env, fds, options = {}) {
    this.args = [];
    this.env = [];
    this.fds = [];
    debug.enable(options.debug);
    this.args = args;
    this.env = env;
    this.fds = fds;
    const self = this;
    this.wasiImport = { args_sizes_get(argc, argv_buf_size) {
      const buffer = new DataView(self.inst.exports.memory.buffer);
      buffer.setUint32(argc, self.args.length, true);
      let buf_size = 0;
      for (const arg of self.args) {
        buf_size += arg.length + 1;
      }
      buffer.setUint32(argv_buf_size, buf_size, true);
      debug.log(buffer.getUint32(argc, true), buffer.getUint32(argv_buf_size, true));
      return 0;
    }, args_get(argv, argv_buf) {
      const buffer = new DataView(self.inst.exports.memory.buffer);
      const buffer8 = new Uint8Array(self.inst.exports.memory.buffer);
      const orig_argv_buf = argv_buf;
      for (let i = 0; i < self.args.length; i++) {
        buffer.setUint32(argv, argv_buf, true);
        argv += 4;
        const arg = new TextEncoder().encode(self.args[i]);
        buffer8.set(arg, argv_buf);
        buffer.setUint8(argv_buf + arg.length, 0);
        argv_buf += arg.length + 1;
      }
      if (debug.enabled) {
        debug.log(new TextDecoder("utf-8").decode(buffer8.slice(orig_argv_buf, argv_buf)));
      }
      return 0;
    }, environ_sizes_get(environ_count, environ_size) {
      const buffer = new DataView(self.inst.exports.memory.buffer);
      buffer.setUint32(environ_count, self.env.length, true);
      let buf_size = 0;
      for (const environ of self.env) {
        buf_size += new TextEncoder().encode(environ).length + 1;
      }
      buffer.setUint32(environ_size, buf_size, true);
      debug.log(buffer.getUint32(environ_count, true), buffer.getUint32(environ_size, true));
      return 0;
    }, environ_get(environ, environ_buf) {
      const buffer = new DataView(self.inst.exports.memory.buffer);
      const buffer8 = new Uint8Array(self.inst.exports.memory.buffer);
      const orig_environ_buf = environ_buf;
      for (let i = 0; i < self.env.length; i++) {
        buffer.setUint32(environ, environ_buf, true);
        environ += 4;
        const e = new TextEncoder().encode(self.env[i]);
        buffer8.set(e, environ_buf);
        buffer.setUint8(environ_buf + e.length, 0);
        environ_buf += e.length + 1;
      }
      if (debug.enabled) {
        debug.log(new TextDecoder("utf-8").decode(buffer8.slice(orig_environ_buf, environ_buf)));
      }
      return 0;
    }, clock_res_get(id, res_ptr) {
      let resolutionValue;
      switch (id) {
        case CLOCKID_MONOTONIC: {
          resolutionValue = 5000n;
          break;
        }
        case CLOCKID_REALTIME: {
          resolutionValue = 1000000n;
          break;
        }
        default:
          return ERRNO_NOSYS;
      }
      const view = new DataView(self.inst.exports.memory.buffer);
      view.setBigUint64(res_ptr, resolutionValue, true);
      return ERRNO_SUCCESS;
    }, clock_time_get(id, precision, time) {
      const buffer = new DataView(self.inst.exports.memory.buffer);
      if (id === CLOCKID_REALTIME) {
        buffer.setBigUint64(time, BigInt((/* @__PURE__ */ new Date()).getTime()) * 1000000n, true);
      } else if (id == CLOCKID_MONOTONIC) {
        let monotonic_time;
        try {
          monotonic_time = BigInt(Math.round(performance.now() * 1e6));
        } catch (e) {
          monotonic_time = 0n;
        }
        buffer.setBigUint64(time, monotonic_time, true);
      } else {
        buffer.setBigUint64(time, 0n, true);
      }
      return 0;
    }, fd_advise(fd, offset, len, advice) {
      if (self.fds[fd] != void 0) {
        return ERRNO_SUCCESS;
      } else {
        return ERRNO_BADF;
      }
    }, fd_allocate(fd, offset, len) {
      if (self.fds[fd] != void 0) {
        return self.fds[fd].fd_allocate(offset, len);
      } else {
        return ERRNO_BADF;
      }
    }, fd_close(fd) {
      if (self.fds[fd] != void 0) {
        const ret = self.fds[fd].fd_close();
        self.fds[fd] = void 0;
        return ret;
      } else {
        return ERRNO_BADF;
      }
    }, fd_datasync(fd) {
      if (self.fds[fd] != void 0) {
        return self.fds[fd].fd_sync();
      } else {
        return ERRNO_BADF;
      }
    }, fd_fdstat_get(fd, fdstat_ptr) {
      if (self.fds[fd] != void 0) {
        const { ret, fdstat } = self.fds[fd].fd_fdstat_get();
        if (fdstat != null) {
          fdstat.write_bytes(new DataView(self.inst.exports.memory.buffer), fdstat_ptr);
        }
        return ret;
      } else {
        return ERRNO_BADF;
      }
    }, fd_fdstat_set_flags(fd, flags) {
      if (self.fds[fd] != void 0) {
        return self.fds[fd].fd_fdstat_set_flags(flags);
      } else {
        return ERRNO_BADF;
      }
    }, fd_fdstat_set_rights(fd, fs_rights_base, fs_rights_inheriting) {
      if (self.fds[fd] != void 0) {
        return self.fds[fd].fd_fdstat_set_rights(fs_rights_base, fs_rights_inheriting);
      } else {
        return ERRNO_BADF;
      }
    }, fd_filestat_get(fd, filestat_ptr) {
      if (self.fds[fd] != void 0) {
        const { ret, filestat } = self.fds[fd].fd_filestat_get();
        if (filestat != null) {
          filestat.write_bytes(new DataView(self.inst.exports.memory.buffer), filestat_ptr);
        }
        return ret;
      } else {
        return ERRNO_BADF;
      }
    }, fd_filestat_set_size(fd, size) {
      if (self.fds[fd] != void 0) {
        return self.fds[fd].fd_filestat_set_size(size);
      } else {
        return ERRNO_BADF;
      }
    }, fd_filestat_set_times(fd, atim, mtim, fst_flags) {
      if (self.fds[fd] != void 0) {
        return self.fds[fd].fd_filestat_set_times(atim, mtim, fst_flags);
      } else {
        return ERRNO_BADF;
      }
    }, fd_pread(fd, iovs_ptr, iovs_len, offset, nread_ptr) {
      const buffer = new DataView(self.inst.exports.memory.buffer);
      const buffer8 = new Uint8Array(self.inst.exports.memory.buffer);
      if (self.fds[fd] != void 0) {
        const iovecs = Iovec.read_bytes_array(buffer, iovs_ptr, iovs_len);
        let nread = 0;
        for (const iovec of iovecs) {
          const { ret, data } = self.fds[fd].fd_pread(iovec.buf_len, offset);
          if (ret != ERRNO_SUCCESS) {
            buffer.setUint32(nread_ptr, nread, true);
            return ret;
          }
          buffer8.set(data, iovec.buf);
          nread += data.length;
          offset += BigInt(data.length);
          if (data.length != iovec.buf_len) {
            break;
          }
        }
        buffer.setUint32(nread_ptr, nread, true);
        return ERRNO_SUCCESS;
      } else {
        return ERRNO_BADF;
      }
    }, fd_prestat_get(fd, buf_ptr) {
      const buffer = new DataView(self.inst.exports.memory.buffer);
      if (self.fds[fd] != void 0) {
        const { ret, prestat } = self.fds[fd].fd_prestat_get();
        if (prestat != null) {
          prestat.write_bytes(buffer, buf_ptr);
        }
        return ret;
      } else {
        return ERRNO_BADF;
      }
    }, fd_prestat_dir_name(fd, path_ptr, path_len) {
      if (self.fds[fd] != void 0) {
        const { ret, prestat } = self.fds[fd].fd_prestat_get();
        if (prestat == null) {
          return ret;
        }
        const prestat_dir_name = prestat.inner.pr_name;
        const buffer8 = new Uint8Array(self.inst.exports.memory.buffer);
        buffer8.set(prestat_dir_name.slice(0, path_len), path_ptr);
        return prestat_dir_name.byteLength > path_len ? ERRNO_NAMETOOLONG : ERRNO_SUCCESS;
      } else {
        return ERRNO_BADF;
      }
    }, fd_pwrite(fd, iovs_ptr, iovs_len, offset, nwritten_ptr) {
      const buffer = new DataView(self.inst.exports.memory.buffer);
      const buffer8 = new Uint8Array(self.inst.exports.memory.buffer);
      if (self.fds[fd] != void 0) {
        const iovecs = Ciovec.read_bytes_array(buffer, iovs_ptr, iovs_len);
        let nwritten = 0;
        for (const iovec of iovecs) {
          const data = buffer8.slice(iovec.buf, iovec.buf + iovec.buf_len);
          const { ret, nwritten: nwritten_part } = self.fds[fd].fd_pwrite(data, offset);
          if (ret != ERRNO_SUCCESS) {
            buffer.setUint32(nwritten_ptr, nwritten, true);
            return ret;
          }
          nwritten += nwritten_part;
          offset += BigInt(nwritten_part);
          if (nwritten_part != data.byteLength) {
            break;
          }
        }
        buffer.setUint32(nwritten_ptr, nwritten, true);
        return ERRNO_SUCCESS;
      } else {
        return ERRNO_BADF;
      }
    }, fd_read(fd, iovs_ptr, iovs_len, nread_ptr) {
      const buffer = new DataView(self.inst.exports.memory.buffer);
      const buffer8 = new Uint8Array(self.inst.exports.memory.buffer);
      if (self.fds[fd] != void 0) {
        const iovecs = Iovec.read_bytes_array(buffer, iovs_ptr, iovs_len);
        let nread = 0;
        for (const iovec of iovecs) {
          const { ret, data } = self.fds[fd].fd_read(iovec.buf_len);
          if (ret != ERRNO_SUCCESS) {
            buffer.setUint32(nread_ptr, nread, true);
            return ret;
          }
          buffer8.set(data, iovec.buf);
          nread += data.length;
          if (data.length != iovec.buf_len) {
            break;
          }
        }
        buffer.setUint32(nread_ptr, nread, true);
        return ERRNO_SUCCESS;
      } else {
        return ERRNO_BADF;
      }
    }, fd_readdir(fd, buf, buf_len, cookie, bufused_ptr) {
      const buffer = new DataView(self.inst.exports.memory.buffer);
      const buffer8 = new Uint8Array(self.inst.exports.memory.buffer);
      if (self.fds[fd] != void 0) {
        let bufused = 0;
        while (true) {
          const { ret, dirent } = self.fds[fd].fd_readdir_single(cookie);
          if (ret != 0) {
            buffer.setUint32(bufused_ptr, bufused, true);
            return ret;
          }
          if (dirent == null) {
            break;
          }
          if (buf_len - bufused < dirent.head_length()) {
            bufused = buf_len;
            break;
          }
          const head_bytes = new ArrayBuffer(dirent.head_length());
          dirent.write_head_bytes(new DataView(head_bytes), 0);
          buffer8.set(new Uint8Array(head_bytes).slice(0, Math.min(head_bytes.byteLength, buf_len - bufused)), buf);
          buf += dirent.head_length();
          bufused += dirent.head_length();
          if (buf_len - bufused < dirent.name_length()) {
            bufused = buf_len;
            break;
          }
          dirent.write_name_bytes(buffer8, buf, buf_len - bufused);
          buf += dirent.name_length();
          bufused += dirent.name_length();
          cookie = dirent.d_next;
        }
        buffer.setUint32(bufused_ptr, bufused, true);
        return 0;
      } else {
        return ERRNO_BADF;
      }
    }, fd_renumber(fd, to) {
      if (self.fds[fd] != void 0 && self.fds[to] != void 0) {
        const ret = self.fds[to].fd_close();
        if (ret != 0) {
          return ret;
        }
        self.fds[to] = self.fds[fd];
        self.fds[fd] = void 0;
        return 0;
      } else {
        return ERRNO_BADF;
      }
    }, fd_seek(fd, offset, whence, offset_out_ptr) {
      const buffer = new DataView(self.inst.exports.memory.buffer);
      if (self.fds[fd] != void 0) {
        const { ret, offset: offset_out } = self.fds[fd].fd_seek(offset, whence);
        buffer.setBigInt64(offset_out_ptr, offset_out, true);
        return ret;
      } else {
        return ERRNO_BADF;
      }
    }, fd_sync(fd) {
      if (self.fds[fd] != void 0) {
        return self.fds[fd].fd_sync();
      } else {
        return ERRNO_BADF;
      }
    }, fd_tell(fd, offset_ptr) {
      const buffer = new DataView(self.inst.exports.memory.buffer);
      if (self.fds[fd] != void 0) {
        const { ret, offset } = self.fds[fd].fd_tell();
        buffer.setBigUint64(offset_ptr, offset, true);
        return ret;
      } else {
        return ERRNO_BADF;
      }
    }, fd_write(fd, iovs_ptr, iovs_len, nwritten_ptr) {
      const buffer = new DataView(self.inst.exports.memory.buffer);
      const buffer8 = new Uint8Array(self.inst.exports.memory.buffer);
      if (self.fds[fd] != void 0) {
        const iovecs = Ciovec.read_bytes_array(buffer, iovs_ptr, iovs_len);
        let nwritten = 0;
        for (const iovec of iovecs) {
          const data = buffer8.slice(iovec.buf, iovec.buf + iovec.buf_len);
          const { ret, nwritten: nwritten_part } = self.fds[fd].fd_write(data);
          if (ret != ERRNO_SUCCESS) {
            buffer.setUint32(nwritten_ptr, nwritten, true);
            return ret;
          }
          nwritten += nwritten_part;
          if (nwritten_part != data.byteLength) {
            break;
          }
        }
        buffer.setUint32(nwritten_ptr, nwritten, true);
        return ERRNO_SUCCESS;
      } else {
        return ERRNO_BADF;
      }
    }, path_create_directory(fd, path_ptr, path_len) {
      const buffer8 = new Uint8Array(self.inst.exports.memory.buffer);
      if (self.fds[fd] != void 0) {
        const path = new TextDecoder("utf-8").decode(buffer8.slice(path_ptr, path_ptr + path_len));
        return self.fds[fd].path_create_directory(path);
      } else {
        return ERRNO_BADF;
      }
    }, path_filestat_get(fd, flags, path_ptr, path_len, filestat_ptr) {
      const buffer = new DataView(self.inst.exports.memory.buffer);
      const buffer8 = new Uint8Array(self.inst.exports.memory.buffer);
      if (self.fds[fd] != void 0) {
        const path = new TextDecoder("utf-8").decode(buffer8.slice(path_ptr, path_ptr + path_len));
        const { ret, filestat } = self.fds[fd].path_filestat_get(flags, path);
        if (filestat != null) {
          filestat.write_bytes(buffer, filestat_ptr);
        }
        return ret;
      } else {
        return ERRNO_BADF;
      }
    }, path_filestat_set_times(fd, flags, path_ptr, path_len, atim, mtim, fst_flags) {
      const buffer8 = new Uint8Array(self.inst.exports.memory.buffer);
      if (self.fds[fd] != void 0) {
        const path = new TextDecoder("utf-8").decode(buffer8.slice(path_ptr, path_ptr + path_len));
        return self.fds[fd].path_filestat_set_times(flags, path, atim, mtim, fst_flags);
      } else {
        return ERRNO_BADF;
      }
    }, path_link(old_fd, old_flags, old_path_ptr, old_path_len, new_fd, new_path_ptr, new_path_len) {
      const buffer8 = new Uint8Array(self.inst.exports.memory.buffer);
      if (self.fds[old_fd] != void 0 && self.fds[new_fd] != void 0) {
        const old_path = new TextDecoder("utf-8").decode(buffer8.slice(old_path_ptr, old_path_ptr + old_path_len));
        const new_path = new TextDecoder("utf-8").decode(buffer8.slice(new_path_ptr, new_path_ptr + new_path_len));
        const { ret, inode_obj } = self.fds[old_fd].path_lookup(old_path, old_flags);
        if (inode_obj == null) {
          return ret;
        }
        return self.fds[new_fd].path_link(new_path, inode_obj, false);
      } else {
        return ERRNO_BADF;
      }
    }, path_open(fd, dirflags, path_ptr, path_len, oflags, fs_rights_base, fs_rights_inheriting, fd_flags, opened_fd_ptr) {
      const buffer = new DataView(self.inst.exports.memory.buffer);
      const buffer8 = new Uint8Array(self.inst.exports.memory.buffer);
      if (self.fds[fd] != void 0) {
        const path = new TextDecoder("utf-8").decode(buffer8.slice(path_ptr, path_ptr + path_len));
        debug.log(path);
        const { ret, fd_obj } = self.fds[fd].path_open(dirflags, path, oflags, fs_rights_base, fs_rights_inheriting, fd_flags);
        if (ret != 0) {
          return ret;
        }
        self.fds.push(fd_obj);
        const opened_fd = self.fds.length - 1;
        buffer.setUint32(opened_fd_ptr, opened_fd, true);
        return 0;
      } else {
        return ERRNO_BADF;
      }
    }, path_readlink(fd, path_ptr, path_len, buf_ptr, buf_len, nread_ptr) {
      const buffer = new DataView(self.inst.exports.memory.buffer);
      const buffer8 = new Uint8Array(self.inst.exports.memory.buffer);
      if (self.fds[fd] != void 0) {
        const path = new TextDecoder("utf-8").decode(buffer8.slice(path_ptr, path_ptr + path_len));
        debug.log(path);
        const { ret, data } = self.fds[fd].path_readlink(path);
        if (data != null) {
          const data_buf = new TextEncoder().encode(data);
          if (data_buf.length > buf_len) {
            buffer.setUint32(nread_ptr, 0, true);
            return ERRNO_BADF;
          }
          buffer8.set(data_buf, buf_ptr);
          buffer.setUint32(nread_ptr, data_buf.length, true);
        }
        return ret;
      } else {
        return ERRNO_BADF;
      }
    }, path_remove_directory(fd, path_ptr, path_len) {
      const buffer8 = new Uint8Array(self.inst.exports.memory.buffer);
      if (self.fds[fd] != void 0) {
        const path = new TextDecoder("utf-8").decode(buffer8.slice(path_ptr, path_ptr + path_len));
        return self.fds[fd].path_remove_directory(path);
      } else {
        return ERRNO_BADF;
      }
    }, path_rename(fd, old_path_ptr, old_path_len, new_fd, new_path_ptr, new_path_len) {
      const buffer8 = new Uint8Array(self.inst.exports.memory.buffer);
      if (self.fds[fd] != void 0 && self.fds[new_fd] != void 0) {
        const old_path = new TextDecoder("utf-8").decode(buffer8.slice(old_path_ptr, old_path_ptr + old_path_len));
        const new_path = new TextDecoder("utf-8").decode(buffer8.slice(new_path_ptr, new_path_ptr + new_path_len));
        let { ret, inode_obj } = self.fds[fd].path_unlink(old_path);
        if (inode_obj == null) {
          return ret;
        }
        ret = self.fds[new_fd].path_link(new_path, inode_obj, true);
        if (ret != ERRNO_SUCCESS) {
          if (self.fds[fd].path_link(old_path, inode_obj, true) != ERRNO_SUCCESS) {
            throw "path_link should always return success when relinking an inode back to the original place";
          }
        }
        return ret;
      } else {
        return ERRNO_BADF;
      }
    }, path_symlink(old_path_ptr, old_path_len, fd, new_path_ptr, new_path_len) {
      const buffer8 = new Uint8Array(self.inst.exports.memory.buffer);
      if (self.fds[fd] != void 0) {
        const old_path = new TextDecoder("utf-8").decode(buffer8.slice(old_path_ptr, old_path_ptr + old_path_len));
        const new_path = new TextDecoder("utf-8").decode(buffer8.slice(new_path_ptr, new_path_ptr + new_path_len));
        return ERRNO_NOTSUP;
      } else {
        return ERRNO_BADF;
      }
    }, path_unlink_file(fd, path_ptr, path_len) {
      const buffer8 = new Uint8Array(self.inst.exports.memory.buffer);
      if (self.fds[fd] != void 0) {
        const path = new TextDecoder("utf-8").decode(buffer8.slice(path_ptr, path_ptr + path_len));
        return self.fds[fd].path_unlink_file(path);
      } else {
        return ERRNO_BADF;
      }
    }, poll_oneoff(in_ptr, out_ptr, nsubscriptions) {
      if (nsubscriptions === 0) {
        return ERRNO_INVAL;
      }
      if (nsubscriptions > 1) {
        debug.log("poll_oneoff: only a single subscription is supported");
        return ERRNO_NOTSUP;
      }
      const buffer = new DataView(self.inst.exports.memory.buffer);
      const s = Subscription.read_bytes(buffer, in_ptr);
      const eventtype = s.eventtype;
      const clockid = s.clockid;
      const timeout = s.timeout;
      if (eventtype !== EVENTTYPE_CLOCK) {
        debug.log("poll_oneoff: only clock subscriptions are supported");
        return ERRNO_NOTSUP;
      }
      let getNow = void 0;
      if (clockid === CLOCKID_MONOTONIC) {
        getNow = () => BigInt(Math.round(performance.now() * 1e6));
      } else if (clockid === CLOCKID_REALTIME) {
        getNow = () => BigInt((/* @__PURE__ */ new Date()).getTime()) * 1000000n;
      } else {
        return ERRNO_INVAL;
      }
      const endTime = (s.flags & SUBCLOCKFLAGS_SUBSCRIPTION_CLOCK_ABSTIME) !== 0 ? timeout : getNow() + timeout;
      while (endTime > getNow()) {
      }
      const event = new Event(s.userdata, ERRNO_SUCCESS, eventtype);
      event.write_bytes(buffer, out_ptr);
      return ERRNO_SUCCESS;
    }, proc_exit(exit_code) {
      throw new WASIProcExit(exit_code);
    }, proc_raise(sig) {
      throw "raised signal " + sig;
    }, sched_yield() {
    }, random_get(buf, buf_len) {
      const buffer8 = new Uint8Array(self.inst.exports.memory.buffer).subarray(buf, buf + buf_len);
      if ("crypto" in globalThis && (typeof SharedArrayBuffer === "undefined" || !(self.inst.exports.memory.buffer instanceof SharedArrayBuffer))) {
        for (let i = 0; i < buf_len; i += 65536) {
          crypto.getRandomValues(buffer8.subarray(i, i + 65536));
        }
      } else {
        for (let i = 0; i < buf_len; i++) {
          buffer8[i] = Math.random() * 256 | 0;
        }
      }
    }, sock_recv(fd, ri_data, ri_flags) {
      throw "sockets not supported";
    }, sock_send(fd, si_data, si_flags) {
      throw "sockets not supported";
    }, sock_shutdown(fd, how) {
      throw "sockets not supported";
    }, sock_accept(fd, flags) {
      throw "sockets not supported";
    } };
  }
};

// node_modules/@bjorn3/browser_wasi_shim/dist/fd.js
var Fd = class {
  fd_allocate(offset, len) {
    return ERRNO_NOTSUP;
  }
  fd_close() {
    return 0;
  }
  fd_fdstat_get() {
    return { ret: ERRNO_NOTSUP, fdstat: null };
  }
  fd_fdstat_set_flags(flags) {
    return ERRNO_NOTSUP;
  }
  fd_fdstat_set_rights(fs_rights_base, fs_rights_inheriting) {
    return ERRNO_NOTSUP;
  }
  fd_filestat_get() {
    return { ret: ERRNO_NOTSUP, filestat: null };
  }
  fd_filestat_set_size(size) {
    return ERRNO_NOTSUP;
  }
  fd_filestat_set_times(atim, mtim, fst_flags) {
    return ERRNO_NOTSUP;
  }
  fd_pread(size, offset) {
    return { ret: ERRNO_NOTSUP, data: new Uint8Array() };
  }
  fd_prestat_get() {
    return { ret: ERRNO_NOTSUP, prestat: null };
  }
  fd_pwrite(data, offset) {
    return { ret: ERRNO_NOTSUP, nwritten: 0 };
  }
  fd_read(size) {
    return { ret: ERRNO_NOTSUP, data: new Uint8Array() };
  }
  fd_readdir_single(cookie) {
    return { ret: ERRNO_NOTSUP, dirent: null };
  }
  fd_seek(offset, whence) {
    return { ret: ERRNO_NOTSUP, offset: 0n };
  }
  fd_sync() {
    return 0;
  }
  fd_tell() {
    return { ret: ERRNO_NOTSUP, offset: 0n };
  }
  fd_write(data) {
    return { ret: ERRNO_NOTSUP, nwritten: 0 };
  }
  path_create_directory(path) {
    return ERRNO_NOTSUP;
  }
  path_filestat_get(flags, path) {
    return { ret: ERRNO_NOTSUP, filestat: null };
  }
  path_filestat_set_times(flags, path, atim, mtim, fst_flags) {
    return ERRNO_NOTSUP;
  }
  path_link(path, inode, allow_dir) {
    return ERRNO_NOTSUP;
  }
  path_unlink(path) {
    return { ret: ERRNO_NOTSUP, inode_obj: null };
  }
  path_lookup(path, dirflags) {
    return { ret: ERRNO_NOTSUP, inode_obj: null };
  }
  path_open(dirflags, path, oflags, fs_rights_base, fs_rights_inheriting, fd_flags) {
    return { ret: ERRNO_NOTDIR, fd_obj: null };
  }
  path_readlink(path) {
    return { ret: ERRNO_NOTSUP, data: null };
  }
  path_remove_directory(path) {
    return ERRNO_NOTSUP;
  }
  path_rename(old_path, new_fd, new_path) {
    return ERRNO_NOTSUP;
  }
  path_unlink_file(path) {
    return ERRNO_NOTSUP;
  }
};
var Inode = class _Inode {
  static issue_ino() {
    return _Inode.next_ino++;
  }
  static root_ino() {
    return 0n;
  }
  constructor() {
    this.ino = _Inode.issue_ino();
  }
};
Inode.next_ino = 1n;

// node_modules/@bjorn3/browser_wasi_shim/dist/fs_mem.js
var OpenFile = class extends Fd {
  fd_allocate(offset, len) {
    if (this.file.size > offset + len) {
    } else {
      const new_data = new Uint8Array(Number(offset + len));
      new_data.set(this.file.data, 0);
      this.file.data = new_data;
    }
    return ERRNO_SUCCESS;
  }
  fd_fdstat_get() {
    return { ret: 0, fdstat: new Fdstat(FILETYPE_REGULAR_FILE, 0) };
  }
  fd_filestat_set_size(size) {
    if (this.file.size > size) {
      this.file.data = new Uint8Array(this.file.data.buffer.slice(0, Number(size)));
    } else {
      const new_data = new Uint8Array(Number(size));
      new_data.set(this.file.data, 0);
      this.file.data = new_data;
    }
    return ERRNO_SUCCESS;
  }
  fd_read(size) {
    const slice = this.file.data.slice(Number(this.file_pos), Number(this.file_pos + BigInt(size)));
    this.file_pos += BigInt(slice.length);
    return { ret: 0, data: slice };
  }
  fd_pread(size, offset) {
    const slice = this.file.data.slice(Number(offset), Number(offset + BigInt(size)));
    return { ret: 0, data: slice };
  }
  fd_seek(offset, whence) {
    let calculated_offset;
    switch (whence) {
      case WHENCE_SET:
        calculated_offset = offset;
        break;
      case WHENCE_CUR:
        calculated_offset = this.file_pos + offset;
        break;
      case WHENCE_END:
        calculated_offset = BigInt(this.file.data.byteLength) + offset;
        break;
      default:
        return { ret: ERRNO_INVAL, offset: 0n };
    }
    if (calculated_offset < 0) {
      return { ret: ERRNO_INVAL, offset: 0n };
    }
    this.file_pos = calculated_offset;
    return { ret: 0, offset: this.file_pos };
  }
  fd_tell() {
    return { ret: 0, offset: this.file_pos };
  }
  fd_write(data) {
    if (this.file.readonly) return { ret: ERRNO_BADF, nwritten: 0 };
    if (this.file_pos + BigInt(data.byteLength) > this.file.size) {
      const old = this.file.data;
      this.file.data = new Uint8Array(Number(this.file_pos + BigInt(data.byteLength)));
      this.file.data.set(old);
    }
    this.file.data.set(data, Number(this.file_pos));
    this.file_pos += BigInt(data.byteLength);
    return { ret: 0, nwritten: data.byteLength };
  }
  fd_pwrite(data, offset) {
    if (this.file.readonly) return { ret: ERRNO_BADF, nwritten: 0 };
    if (offset + BigInt(data.byteLength) > this.file.size) {
      const old = this.file.data;
      this.file.data = new Uint8Array(Number(offset + BigInt(data.byteLength)));
      this.file.data.set(old);
    }
    this.file.data.set(data, Number(offset));
    return { ret: 0, nwritten: data.byteLength };
  }
  fd_filestat_get() {
    return { ret: 0, filestat: this.file.stat() };
  }
  constructor(file) {
    super();
    this.file_pos = 0n;
    this.file = file;
  }
};
var OpenDirectory = class extends Fd {
  fd_seek(offset, whence) {
    return { ret: ERRNO_BADF, offset: 0n };
  }
  fd_tell() {
    return { ret: ERRNO_BADF, offset: 0n };
  }
  fd_allocate(offset, len) {
    return ERRNO_BADF;
  }
  fd_fdstat_get() {
    return { ret: 0, fdstat: new Fdstat(FILETYPE_DIRECTORY, 0) };
  }
  fd_readdir_single(cookie) {
    if (debug.enabled) {
      debug.log("readdir_single", cookie);
      debug.log(cookie, this.dir.contents.keys());
    }
    if (cookie == 0n) {
      return { ret: ERRNO_SUCCESS, dirent: new Dirent(1n, this.dir.ino, ".", FILETYPE_DIRECTORY) };
    } else if (cookie == 1n) {
      return { ret: ERRNO_SUCCESS, dirent: new Dirent(2n, this.dir.parent_ino(), "..", FILETYPE_DIRECTORY) };
    }
    if (cookie >= BigInt(this.dir.contents.size) + 2n) {
      return { ret: 0, dirent: null };
    }
    const [name, entry] = Array.from(this.dir.contents.entries())[Number(cookie - 2n)];
    return { ret: 0, dirent: new Dirent(cookie + 1n, entry.ino, name, entry.stat().filetype) };
  }
  path_filestat_get(flags, path_str) {
    const { ret: path_err, path } = Path.from(path_str);
    if (path == null) {
      return { ret: path_err, filestat: null };
    }
    const { ret, entry } = this.dir.get_entry_for_path(path);
    if (entry == null) {
      return { ret, filestat: null };
    }
    return { ret: 0, filestat: entry.stat() };
  }
  path_lookup(path_str, dirflags) {
    const { ret: path_ret, path } = Path.from(path_str);
    if (path == null) {
      return { ret: path_ret, inode_obj: null };
    }
    const { ret, entry } = this.dir.get_entry_for_path(path);
    if (entry == null) {
      return { ret, inode_obj: null };
    }
    return { ret: ERRNO_SUCCESS, inode_obj: entry };
  }
  path_open(dirflags, path_str, oflags, fs_rights_base, fs_rights_inheriting, fd_flags) {
    const { ret: path_ret, path } = Path.from(path_str);
    if (path == null) {
      return { ret: path_ret, fd_obj: null };
    }
    let { ret, entry } = this.dir.get_entry_for_path(path);
    if (entry == null) {
      if (ret != ERRNO_NOENT) {
        return { ret, fd_obj: null };
      }
      if ((oflags & OFLAGS_CREAT) == OFLAGS_CREAT) {
        const { ret: ret2, entry: new_entry } = this.dir.create_entry_for_path(path_str, (oflags & OFLAGS_DIRECTORY) == OFLAGS_DIRECTORY);
        if (new_entry == null) {
          return { ret: ret2, fd_obj: null };
        }
        entry = new_entry;
      } else {
        return { ret: ERRNO_NOENT, fd_obj: null };
      }
    } else if ((oflags & OFLAGS_EXCL) == OFLAGS_EXCL) {
      return { ret: ERRNO_EXIST, fd_obj: null };
    }
    if ((oflags & OFLAGS_DIRECTORY) == OFLAGS_DIRECTORY && entry.stat().filetype !== FILETYPE_DIRECTORY) {
      return { ret: ERRNO_NOTDIR, fd_obj: null };
    }
    return entry.path_open(oflags, fs_rights_base, fd_flags);
  }
  path_create_directory(path) {
    return this.path_open(0, path, OFLAGS_CREAT | OFLAGS_DIRECTORY, 0n, 0n, 0).ret;
  }
  path_link(path_str, inode, allow_dir) {
    const { ret: path_ret, path } = Path.from(path_str);
    if (path == null) {
      return path_ret;
    }
    if (path.is_dir) {
      return ERRNO_NOENT;
    }
    const { ret: parent_ret, parent_entry, filename, entry } = this.dir.get_parent_dir_and_entry_for_path(path, true);
    if (parent_entry == null || filename == null) {
      return parent_ret;
    }
    if (entry != null) {
      const source_is_dir = inode.stat().filetype == FILETYPE_DIRECTORY;
      const target_is_dir = entry.stat().filetype == FILETYPE_DIRECTORY;
      if (source_is_dir && target_is_dir) {
        if (allow_dir && entry instanceof Directory) {
          if (entry.contents.size == 0) {
          } else {
            return ERRNO_NOTEMPTY;
          }
        } else {
          return ERRNO_EXIST;
        }
      } else if (source_is_dir && !target_is_dir) {
        return ERRNO_NOTDIR;
      } else if (!source_is_dir && target_is_dir) {
        return ERRNO_ISDIR;
      } else if (inode.stat().filetype == FILETYPE_REGULAR_FILE && entry.stat().filetype == FILETYPE_REGULAR_FILE) {
      } else {
        return ERRNO_EXIST;
      }
    }
    if (!allow_dir && inode.stat().filetype == FILETYPE_DIRECTORY) {
      return ERRNO_PERM;
    }
    parent_entry.contents.set(filename, inode);
    return ERRNO_SUCCESS;
  }
  path_unlink(path_str) {
    const { ret: path_ret, path } = Path.from(path_str);
    if (path == null) {
      return { ret: path_ret, inode_obj: null };
    }
    const { ret: parent_ret, parent_entry, filename, entry } = this.dir.get_parent_dir_and_entry_for_path(path, true);
    if (parent_entry == null || filename == null) {
      return { ret: parent_ret, inode_obj: null };
    }
    if (entry == null) {
      return { ret: ERRNO_NOENT, inode_obj: null };
    }
    parent_entry.contents.delete(filename);
    return { ret: ERRNO_SUCCESS, inode_obj: entry };
  }
  path_unlink_file(path_str) {
    const { ret: path_ret, path } = Path.from(path_str);
    if (path == null) {
      return path_ret;
    }
    const { ret: parent_ret, parent_entry, filename, entry } = this.dir.get_parent_dir_and_entry_for_path(path, false);
    if (parent_entry == null || filename == null || entry == null) {
      return parent_ret;
    }
    if (entry.stat().filetype === FILETYPE_DIRECTORY) {
      return ERRNO_ISDIR;
    }
    parent_entry.contents.delete(filename);
    return ERRNO_SUCCESS;
  }
  path_remove_directory(path_str) {
    const { ret: path_ret, path } = Path.from(path_str);
    if (path == null) {
      return path_ret;
    }
    const { ret: parent_ret, parent_entry, filename, entry } = this.dir.get_parent_dir_and_entry_for_path(path, false);
    if (parent_entry == null || filename == null || entry == null) {
      return parent_ret;
    }
    if (!(entry instanceof Directory) || entry.stat().filetype !== FILETYPE_DIRECTORY) {
      return ERRNO_NOTDIR;
    }
    if (entry.contents.size !== 0) {
      return ERRNO_NOTEMPTY;
    }
    if (!parent_entry.contents.delete(filename)) {
      return ERRNO_NOENT;
    }
    return ERRNO_SUCCESS;
  }
  fd_filestat_get() {
    return { ret: 0, filestat: this.dir.stat() };
  }
  fd_filestat_set_size(size) {
    return ERRNO_BADF;
  }
  fd_read(size) {
    return { ret: ERRNO_BADF, data: new Uint8Array() };
  }
  fd_pread(size, offset) {
    return { ret: ERRNO_BADF, data: new Uint8Array() };
  }
  fd_write(data) {
    return { ret: ERRNO_BADF, nwritten: 0 };
  }
  fd_pwrite(data, offset) {
    return { ret: ERRNO_BADF, nwritten: 0 };
  }
  constructor(dir) {
    super();
    this.dir = dir;
  }
};
var PreopenDirectory = class extends OpenDirectory {
  fd_prestat_get() {
    return { ret: 0, prestat: Prestat.dir(this.prestat_name) };
  }
  constructor(name, contents) {
    super(new Directory(contents));
    this.prestat_name = name;
  }
};
var File = class extends Inode {
  path_open(oflags, fs_rights_base, fd_flags) {
    if (this.readonly && (fs_rights_base & BigInt(RIGHTS_FD_WRITE)) == BigInt(RIGHTS_FD_WRITE)) {
      return { ret: ERRNO_PERM, fd_obj: null };
    }
    if ((oflags & OFLAGS_TRUNC) == OFLAGS_TRUNC) {
      if (this.readonly) return { ret: ERRNO_PERM, fd_obj: null };
      this.data = new Uint8Array([]);
    }
    const file = new OpenFile(this);
    if (fd_flags & FDFLAGS_APPEND) file.fd_seek(0n, WHENCE_END);
    return { ret: ERRNO_SUCCESS, fd_obj: file };
  }
  get size() {
    return BigInt(this.data.byteLength);
  }
  stat() {
    return new Filestat(this.ino, FILETYPE_REGULAR_FILE, this.size);
  }
  constructor(data, options) {
    super();
    this.data = new Uint8Array(data);
    this.readonly = !!options?.readonly;
  }
};
var Path = class Path2 {
  static from(path) {
    const self = new Path2();
    self.is_dir = path.endsWith("/");
    if (path.startsWith("/")) {
      return { ret: ERRNO_NOTCAPABLE, path: null };
    }
    if (path.includes("\0")) {
      return { ret: ERRNO_INVAL, path: null };
    }
    for (const component of path.split("/")) {
      if (component === "" || component === ".") {
        continue;
      }
      if (component === "..") {
        if (self.parts.pop() == void 0) {
          return { ret: ERRNO_NOTCAPABLE, path: null };
        }
        continue;
      }
      self.parts.push(component);
    }
    return { ret: ERRNO_SUCCESS, path: self };
  }
  to_path_string() {
    let s = this.parts.join("/");
    if (this.is_dir) {
      s += "/";
    }
    return s;
  }
  constructor() {
    this.parts = [];
    this.is_dir = false;
  }
};
var Directory = class _Directory extends Inode {
  parent_ino() {
    if (this.parent == null) {
      return Inode.root_ino();
    }
    return this.parent.ino;
  }
  path_open(oflags, fs_rights_base, fd_flags) {
    return { ret: ERRNO_SUCCESS, fd_obj: new OpenDirectory(this) };
  }
  stat() {
    return new Filestat(this.ino, FILETYPE_DIRECTORY, 0n);
  }
  get_entry_for_path(path) {
    let entry = this;
    for (const component of path.parts) {
      if (!(entry instanceof _Directory)) {
        return { ret: ERRNO_NOTDIR, entry: null };
      }
      const child = entry.contents.get(component);
      if (child !== void 0) {
        entry = child;
      } else {
        debug.log(component);
        return { ret: ERRNO_NOENT, entry: null };
      }
    }
    if (path.is_dir) {
      if (entry.stat().filetype != FILETYPE_DIRECTORY) {
        return { ret: ERRNO_NOTDIR, entry: null };
      }
    }
    return { ret: ERRNO_SUCCESS, entry };
  }
  get_parent_dir_and_entry_for_path(path, allow_undefined) {
    const filename = path.parts.pop();
    if (filename === void 0) {
      return { ret: ERRNO_INVAL, parent_entry: null, filename: null, entry: null };
    }
    const { ret: entry_ret, entry: parent_entry } = this.get_entry_for_path(path);
    if (parent_entry == null) {
      return { ret: entry_ret, parent_entry: null, filename: null, entry: null };
    }
    if (!(parent_entry instanceof _Directory)) {
      return { ret: ERRNO_NOTDIR, parent_entry: null, filename: null, entry: null };
    }
    const entry = parent_entry.contents.get(filename);
    if (entry === void 0) {
      if (!allow_undefined) {
        return { ret: ERRNO_NOENT, parent_entry: null, filename: null, entry: null };
      } else {
        return { ret: ERRNO_SUCCESS, parent_entry, filename, entry: null };
      }
    }
    if (path.is_dir) {
      if (entry.stat().filetype != FILETYPE_DIRECTORY) {
        return { ret: ERRNO_NOTDIR, parent_entry: null, filename: null, entry: null };
      }
    }
    return { ret: ERRNO_SUCCESS, parent_entry, filename, entry };
  }
  create_entry_for_path(path_str, is_dir) {
    const { ret: path_ret, path } = Path.from(path_str);
    if (path == null) {
      return { ret: path_ret, entry: null };
    }
    let { ret: parent_ret, parent_entry, filename, entry } = this.get_parent_dir_and_entry_for_path(path, true);
    if (parent_entry == null || filename == null) {
      return { ret: parent_ret, entry: null };
    }
    if (entry != null) {
      return { ret: ERRNO_EXIST, entry: null };
    }
    debug.log("create", path);
    let new_child;
    if (!is_dir) {
      new_child = new File(new ArrayBuffer(0));
    } else {
      new_child = new _Directory(/* @__PURE__ */ new Map());
    }
    parent_entry.contents.set(filename, new_child);
    entry = new_child;
    return { ret: ERRNO_SUCCESS, entry };
  }
  constructor(contents) {
    super();
    this.parent = null;
    if (contents instanceof Array) {
      this.contents = new Map(contents);
    } else {
      this.contents = contents;
    }
    for (const entry of this.contents.values()) {
      if (entry instanceof _Directory) {
        entry.parent = this;
      }
    }
  }
};
var ConsoleStdout = class _ConsoleStdout extends Fd {
  fd_filestat_get() {
    const filestat = new Filestat(this.ino, FILETYPE_CHARACTER_DEVICE, BigInt(0));
    return { ret: 0, filestat };
  }
  fd_fdstat_get() {
    const fdstat = new Fdstat(FILETYPE_CHARACTER_DEVICE, 0);
    fdstat.fs_rights_base = BigInt(RIGHTS_FD_WRITE);
    return { ret: 0, fdstat };
  }
  fd_write(data) {
    this.write(data);
    return { ret: 0, nwritten: data.byteLength };
  }
  static lineBuffered(write) {
    const dec = new TextDecoder("utf-8", { fatal: false });
    let line_buf = "";
    return new _ConsoleStdout((buffer) => {
      line_buf += dec.decode(buffer, { stream: true });
      const lines = line_buf.split("\n");
      for (const [i, line] of lines.entries()) {
        if (i < lines.length - 1) {
          write(line);
        } else {
          line_buf = line;
        }
      }
    });
  }
  constructor(write) {
    super();
    this.ino = Inode.issue_ino();
    this.write = write;
  }
};

// node_modules/nanotar/dist/index.mjs
var TAR_TYPE_FILE = 0;
var TAR_TYPE_DIR = 5;
function parseTar(data, opts) {
  const buffer = data.buffer || data;
  const files = [];
  let offset = 0;
  while (offset < buffer.byteLength - 512) {
    let name = _readString(buffer, offset, 100);
    if (name.length === 0) {
      break;
    }
    const mode = _readString(buffer, offset + 100, 8).trim();
    const uid = Number.parseInt(_readString(buffer, offset + 108, 8));
    const gid = Number.parseInt(_readString(buffer, offset + 116, 8));
    const size = _readNumber(buffer, offset + 124, 12);
    const seek = 512 + 512 * Math.trunc(size / 512) + (size % 512 ? 512 : 0);
    const mtime = _readNumber(buffer, offset + 136, 12);
    const _type = _readNumber(buffer, offset + 156, 1);
    const type = _type === TAR_TYPE_FILE ? "file" : _type === TAR_TYPE_DIR ? "directory" : _type;
    const user = _readString(buffer, offset + 265, 32);
    const group = _readString(buffer, offset + 297, 32);
    name = _sanitizePath(name);
    const meta = {
      name,
      type,
      size,
      attrs: {
        mode,
        uid,
        gid,
        mtime,
        user,
        group
      }
    };
    if (opts?.filter && !opts.filter(meta)) {
      offset += seek;
      continue;
    }
    if (opts?.metaOnly) {
      files.push(meta);
      offset += seek;
      continue;
    }
    const data2 = _type === TAR_TYPE_DIR ? void 0 : new Uint8Array(buffer, offset + 512, size);
    files.push({
      ...meta,
      data: data2,
      get text() {
        return new TextDecoder().decode(this.data);
      }
    });
    offset += seek;
  }
  return files;
}
async function parseTarGzip(data, opts = {}) {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(data));
      controller.close();
    }
  }).pipeThrough(new DecompressionStream(opts.compression ?? "gzip"));
  const decompressedData = await new Response(stream).arrayBuffer();
  return parseTar(decompressedData, opts);
}
function _sanitizePath(path) {
  let normalized = path.replace(/\\/g, "/");
  normalized = normalized.replace(/^[a-zA-Z]:\//, "");
  normalized = normalized.replace(/^\/+/, "");
  const hasLeadingDotSlash = normalized.startsWith("./");
  const parts = normalized.split("/");
  const resolved = [];
  for (const part of parts) {
    if (part === "..") {
      resolved.pop();
    } else if (part !== "." && part !== "") {
      resolved.push(part);
    }
  }
  let result = resolved.join("/");
  if (hasLeadingDotSlash && !result.startsWith("./")) {
    result = "./" + result;
  }
  if (path.endsWith("/") && !result.endsWith("/")) {
    result += "/";
  }
  return result;
}
function _readString(buffer, offset, size) {
  const view = new Uint8Array(buffer, offset, size);
  const i = view.indexOf(0);
  const td = new TextDecoder();
  return td.decode(i === -1 ? view : view.slice(0, i));
}
function _readNumber(buffer, offset, size) {
  const view = new Uint8Array(buffer, offset, size);
  let str = "";
  for (let i = 0; i < size; i++) {
    str += String.fromCodePoint(view[i]);
  }
  return Number.parseInt(str, 8);
}

// packages/elm-wasm/src/compiler.js
var textEncoder = new TextEncoder();
var textDecoder = new TextDecoder();
async function createElmCompiler({
  wasmBytes,
  jsffi,
  artifactsTarGz,
  elmInitTarGz,
  log: log2
} = {}) {
  if (typeof wasmBytes === "undefined") throw new Error("createElmCompiler: `wasmBytes` is required");
  if (typeof jsffi !== "function") throw new Error("createElmCompiler: `jsffi` must be the `ulm.js` default export");
  const writeLog = (msg) => {
    if (log2) log2(msg);
  };
  const pkgDir = new Directory([]);
  const fs = new PreopenDirectory("/", [
    ["src", new Directory([])],
    ["tmp", new Directory([])],
    ["elm-home", new Directory([["0.19.1", new Directory([["packages", pkgDir]])]])],
    ["packages", new Directory([])]
  ]);
  function createDir(dirpath) {
    dirpath = dirpath.replaceAll("//", "/");
    while (dirpath.startsWith("/")) dirpath = dirpath.slice(1);
    while (dirpath.endsWith("/")) dirpath = dirpath.slice(0, -1);
    const segments = dirpath.split("/");
    let node = fs.dir;
    for (const segment of segments) {
      let next = node.contents.get(segment);
      if (!next) {
        next = new Directory([]);
        node.contents.set(segment, next);
      }
      if (!(next instanceof Directory)) {
        throw new Error(`Cannot create directory "${dirpath}": "${segment}" already exists`);
      }
      node = next;
    }
    return node;
  }
  function writeFileInDir(dir, name, content) {
    const buf = typeof content === "string" ? textEncoder.encode(content) : content;
    dir.contents.set(name, new File(buf));
  }
  function writeFile(filepath, content) {
    filepath = filepath.replaceAll("//", "/");
    const lastSlash = filepath.lastIndexOf("/");
    let dir = fs.dir;
    if (lastSlash > 0) dir = createDir(filepath.slice(0, lastSlash));
    writeFileInDir(dir, filepath.slice(lastSlash + 1), content);
  }
  async function unpackInto({ dest = "/", tar }) {
    for (const file of tar) {
      let fullpath = file.name;
      while (fullpath.startsWith("/")) fullpath = fullpath.slice(1);
      while (fullpath.endsWith("/")) fullpath = fullpath.slice(0, -1);
      if (!fullpath) continue;
      fullpath = (dest === "/" ? "" : dest) + "/" + fullpath;
      switch (file.type) {
        case "file":
          writeFile(fullpath, file.data ?? new Uint8Array());
          break;
        case "directory":
          createDir(fullpath);
          break;
        default:
          writeLog(`[compiler] ignoring unsupported tar entry type "${file.type}"`);
      }
    }
  }
  function readFile(filepath) {
    let node = fs.dir;
    for (const part of filepath.split("/")) {
      if (!part) continue;
      if (!(node instanceof Directory)) throw new Error(`Not a directory while resolving "${filepath}"`);
      const next = node.contents.get(part);
      if (!next) throw new Error(`Could not find "${part}" in path "${filepath}"`);
      node = next;
    }
    if (!(node instanceof File)) throw new Error(`Expected "${filepath}" to be a file`);
    return node.data;
  }
  const readText = (filepath) => textDecoder.decode(readFile(filepath));
  if (elmInitTarGz) {
    await unpackInto({ dest: "/", tar: await parseTarGzip(toUint8Array(elmInitTarGz)) });
  }
  if (artifactsTarGz) {
    await unpackInto({
      dest: "/elm-home/0.19.1/packages",
      tar: await parseTarGzip(toUint8Array(artifactsTarGz))
    });
  }
  const wasmExports = {};
  const fds = [
    new OpenFile(new File([])),
    // stdin
    ConsoleStdout.lineBuffered((msg) => writeLog(`[wasi:out] ${msg}`)),
    ConsoleStdout.lineBuffered((msg) => writeLog(`[wasi:err] ${msg}`)),
    fs
  ];
  const wasi = new WASI([], [], fds, { debug: false });
  const { instance } = await WebAssembly.instantiate(toUint8Array(wasmBytes), {
    ghc_wasm_jsffi: jsffi(wasmExports),
    wasi_snapshot_preview1: wasi.wasiImport
  });
  Object.assign(wasmExports, instance.exports);
  wasi.initialize(instance);
  if (typeof wasmExports.compile !== "function") {
    throw new Error(
      `The compiler module does not export a \`compile\` function (exports: ${Object.keys(wasmExports).join(", ")})`
    );
  }
  async function compile(source) {
    const raw = await wasmExports.compile(source);
    const envelope = typeof raw === "string" ? JSON.parse(raw) : raw;
    const result = normalizeResult(envelope);
    if (result.type === "success" && result.file) {
      return { ...result, js: readText(result.file) };
    }
    return result;
  }
  function normalizeResult(envelope) {
    if (envelope && typeof envelope === "object" && "fn" in envelope && "result" in envelope) {
      const data = envelope.data ?? {};
      if (envelope.result === "ok") return { type: "success", ...data };
      if (data.errors) return { type: "compile-errors", ...data };
      return { type: "error", ...data };
    }
    return envelope;
  }
  function printFs() {
    const withIndent = (indent, node) => {
      let str = node.constructor.name ?? "<unknown>";
      if (node.contents) {
        str += ` [${node.contents.size}]
`;
        node.contents.forEach((val, key) => {
          str += "  ".repeat(indent) + key + " " + withIndent(indent + 1, val);
        });
      } else if (node instanceof File) {
        str += ` (${node.size} bytes)
`;
      } else {
        str += "\n";
      }
      return str;
    };
    return fs.prestat_name + withIndent(1, fs.dir);
  }
  function listPackages() {
    const packages = [];
    for (const [author, authorDir] of pkgDir.contents) {
      if (!(authorDir instanceof Directory)) continue;
      for (const [pkg, versions] of authorDir.contents) {
        if (!(versions instanceof Directory)) continue;
        for (const [version, versionDir] of versions.contents) {
          if (!(versionDir instanceof Directory)) continue;
          const elmJsonFile = versionDir.contents.get("elm.json");
          if (!(elmJsonFile instanceof File)) continue;
          try {
            const elmJson = JSON.parse(textDecoder.decode(elmJsonFile.data));
            const exposed = elmJson["exposed-modules"];
            packages.push({
              name: `${author}/${pkg}`,
              version,
              // Kernel packages describe exposure as { kernelGroup: [modules] }.
              modules: Array.isArray(exposed) ? exposed : Object.values(exposed ?? {}).flat()
            });
          } catch {
          }
        }
      }
    }
    return packages;
  }
  function listModules() {
    const names = /* @__PURE__ */ new Set();
    for (const pkg of listPackages()) for (const m of pkg.modules) names.add(m);
    return names;
  }
  function listImportableModules() {
    const elmJson = JSON.parse(readText("/elm.json"));
    const dependencies = /* @__PURE__ */ new Set([
      ...Object.keys(elmJson.dependencies?.direct ?? {}),
      ...Object.keys(elmJson.dependencies?.indirect ?? {})
    ]);
    const modules = /* @__PURE__ */ new Set();
    for (const pkg of listPackages()) {
      if (!dependencies.has(pkg.name)) continue;
      for (const moduleName of pkg.modules) modules.add(moduleName);
    }
    return modules;
  }
  const packagePath = (name, version) => `/elm-home/0.19.1/packages/${name}/${version}`;
  function installPackage({ name, version, elmJson, files = {} }) {
    const base = packagePath(name, version);
    writeFile(`${base}/elm.json`, typeof elmJson === "string" ? elmJson : JSON.stringify(elmJson, null, 4));
    for (const [relativePath, content] of Object.entries(files)) {
      writeFile(`${base}/${relativePath}`, content);
    }
    return base;
  }
  function readPackageElmJson(name, version) {
    try {
      return JSON.parse(readText(`${packagePath(name, version)}/elm.json`));
    } catch {
      return null;
    }
  }
  function setApplicationElmJson(elmJson, filepath = "/elm.json") {
    writeFile(filepath, typeof elmJson === "string" ? elmJson : JSON.stringify(elmJson, null, 4));
  }
  return {
    compile,
    readFile,
    readText,
    writeFile,
    createDir,
    unpackInto,
    installPackage,
    readPackageElmJson,
    setApplicationElmJson,
    listPackages,
    listModules,
    listImportableModules,
    printFs,
    fs,
    pkgDir,
    exports: wasmExports
  };
}
function toUint8Array(bytes) {
  if (bytes instanceof Uint8Array) return bytes;
  return new Uint8Array(bytes);
}
function wrapJsInHtml(js, name) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${name}</title>
  <style>body { padding: 8px; font-family: sans-serif; }</style>
</head>
<body>
<pre id="elm"></pre>
<script>
try {
${js}
  var app = Elm.${name}.init({ node: document.getElementById("elm") });
} catch (e) {
  var header = document.createElement("h1");
  header.style.fontFamily = "monospace";
  header.innerText = "Initialization Error";
  var pre = document.getElementById("elm");
  document.body.insertBefore(header, pre);
  pre.innerText = e;
  throw e;
}
<\/script>
</body>
</html>`;
}

// packages/elm-wasm/src/sources.js
var flattenTree = (nodes, prefix = "") => {
  const paths = [];
  for (const node of nodes || []) {
    const full = prefix ? `${prefix}/${node.name}` : node.name;
    if (node.type === "directory") paths.push(...flattenTree(node.files, full));
    else paths.push(full);
  }
  return paths;
};
var jsdelivrHost = (host) => ({
  id: host === "cdn.jsdelivr.net" ? "jsdelivr" : `${host.replace(/\..*/, "")}.jsdelivr`,
  fileUrl: (name, version, path) => `https://${host}/gh/${name}@${version}/${path}`,
  async listFiles(name, version) {
    const res = await fetch(`https://data.jsdelivr.com/v1/packages/gh/${name}@${version}`);
    if (!res.ok) throw new Error(`jsDelivr listing failed (HTTP ${res.status})`);
    const data = await res.json();
    return flattenTree(data.files);
  }
});
var jsdelivr = jsdelivrHost("cdn.jsdelivr.net");
var fastlyJsdelivr = jsdelivrHost("fastly.jsdelivr.net");
var gcoreJsdelivr = jsdelivrHost("gcore.jsdelivr.net");
var bCdnJsdelivr = jsdelivrHost("jsdelivr.b-cdn.net");
var github = {
  id: "github",
  fileUrl: (name, version, path) => `https://raw.githubusercontent.com/${name}/${version}/${path}`,
  async listFiles(name, version) {
    const res = await fetch(`https://api.github.com/repos/${name}/git/trees/${version}?recursive=1`);
    if (!res.ok) throw new Error(`GitHub tree API failed (HTTP ${res.status})`);
    const tree = await res.json();
    return (tree.tree ?? []).filter((entry) => entry.type === "blob").map((entry) => entry.path);
  }
};
var statically = {
  id: "statically",
  fileUrl: (name, version, path) => `https://cdn.statically.io/gh/${name}/${version}/${path}`
  // No listing API — paths are derived from the package's exposed modules.
};
var templateSource = (template) => ({
  id: `template(${template})`,
  fileUrl: (name, version, path) => template.replaceAll("{name}", name).replaceAll("{version}", version).replaceAll("{path}", path)
});
var NAMED = {
  jsdelivr,
  github,
  statically,
  "fastly.jsdelivr": fastlyJsdelivr,
  "gcore.jsdelivr": gcoreJsdelivr,
  "jsdelivr.b-cdn": bCdnJsdelivr
};
var sourceNames = Object.keys(NAMED);
var DEFAULT_CHAIN = ["jsdelivr", "github"];
function getSources(cdn2) {
  const requested = cdn2 === void 0 || cdn2 === null || cdn2 === "" ? [] : Array.isArray(cdn2) ? cdn2 : [cdn2];
  const sources = [];
  const seen = /* @__PURE__ */ new Set();
  const add = (source) => {
    if (source && !seen.has(source.id)) {
      seen.add(source.id);
      sources.push(source);
    }
  };
  for (const item of requested) {
    add(NAMED[item] ?? (typeof item === "string" && item.includes("{") ? templateSource(item) : null));
  }
  for (const id of DEFAULT_CHAIN) add(NAMED[id]);
  return sources;
}
var derivePaths = (elmJson) => {
  const exposed = elmJson["exposed-modules"];
  const modules = Array.isArray(exposed) ? exposed : Object.values(exposed ?? {}).flat();
  return modules.map((name) => `src/${name.split(".").join("/")}.elm`);
};
async function fetchPackage(name, version, { sources = getSources(), log: log2 } = {}) {
  const errors = [];
  for (const source of sources) {
    try {
      const elmRes = await fetch(source.fileUrl(name, version, "elm.json"));
      if (!elmRes.ok) throw new Error(`elm.json: HTTP ${elmRes.status}`);
      const elmJson = await elmRes.json();
      let paths;
      try {
        paths = source.listFiles ? await source.listFiles(name, version) : derivePaths(elmJson);
      } catch (err) {
        errors.push(`${source.id} list: ${err.message}`);
        paths = derivePaths(elmJson);
      }
      const files = {};
      await Promise.all(
        paths.filter((path) => path.startsWith("src/")).map(async (path) => {
          const res = await fetch(source.fileUrl(name, version, path));
          if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
          files[path] = await res.text();
        })
      );
      return { elmJson, files, source: source.id };
    } catch (err) {
      errors.push(`${source.id}: ${err.message}`);
      log2?.(`  ${source.id} could not provide ${name}@${version} (${err.message})`);
    }
  }
  throw new Error(`Could not fetch ${name}@${version} (${errors.join("; ")})`);
}
var URL_PATTERNS = [
  /^https?:\/\/cdn\.jsdelivr\.net\/gh\/([^/@]+\/[^/@]+)@([^/]+)\/(.+)$/i,
  /^https?:\/\/(?:fastly|gcore|testingcf)\.jsdelivr\.net\/gh\/([^/@]+\/[^/@]+)@([^/]+)\/(.+)$/i,
  /^https?:\/\/jsdelivr\.b-cdn\.net\/gh\/([^/@]+\/[^/@]+)@([^/]+)\/(.+)$/i,
  /^https?:\/\/raw\.githubusercontent\.com\/([^/]+\/[^/]+)\/([^/]+)\/(.+)$/i,
  /^https?:\/\/cdn\.statically\.io\/gh\/([^/]+\/[^/]+)\/([^/]+)\/(.+)$/i
];
function packageFromUrl(url) {
  for (const pattern of URL_PATTERNS) {
    const match = pattern.exec(url || "");
    if (match) return { name: match[1], version: match[2], path: match[3] };
  }
  return null;
}

// packages/elm-wasm/src/packages.js
var compareVersions = (a, b) => {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i += 1) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  }
  return 0;
};
function parseSpec(spec) {
  const [name, version] = spec.trim().split("@");
  if (!/^[\w.-]+\/[\w.-]+$/.test(name || "")) throw new Error(`Invalid package spec: "${spec}"`);
  if (version && !/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`Invalid version in "${spec}"`);
  return { name, version };
}
function satisfies(version, constraint) {
  const m = /^\s*(\d+\.\d+\.\d+)\s*<=\s*v\s*<\s*(\d+\.\d+\.\d+)\s*$/.exec(constraint || "");
  if (!m) return true;
  return compareVersions(version, m[1]) >= 0 && compareVersions(version, m[2]) < 0;
}
var lowerBound = (constraint) => /(\d+\.\d+\.\d+)\s*<=/.exec(constraint || "")?.[1] ?? null;
async function latestVersion(name) {
  try {
    const res2 = await fetch(`https://data.jsdelivr.com/v1/packages/gh/${name}`);
    if (res2.ok) {
      const data = await res2.json();
      const versions2 = (data.versions ?? []).map((v) => typeof v === "string" ? v : v.version).filter((v) => /^\d+\.\d+\.\d+$/.test(v));
      if (versions2.length) return versions2.sort(compareVersions).at(-1);
    }
  } catch {
  }
  const res = await fetch(`https://api.github.com/repos/${name}/tags?per_page=100`);
  if (!res.ok) throw new Error(`Could not list tags for ${name} (HTTP ${res.status})`);
  const versions = (await res.json()).map((tag) => tag.name.replace(/^v/, "")).filter((v) => /^\d+\.\d+\.\d+$/.test(v));
  if (!versions.length) throw new Error(`No version tags found for ${name}`);
  return versions.sort(compareVersions).at(-1);
}
async function installPackages(compiler, specs, { log: log2 = () => {
}, cdn: cdn2, sources = getSources(cdn2) } = {}) {
  const base = JSON.parse(compiler.readText("/elm.json"));
  const direct = { ...base.dependencies.direct };
  const indirect = { ...base.dependencies.indirect };
  const required = /* @__PURE__ */ new Set([...Object.keys(direct), ...Object.keys(indirect)]);
  const onDisk = new Map(compiler.listPackages().map((pkg) => [pkg.name, pkg.version]));
  const installed = /* @__PURE__ */ new Set();
  const queue = [];
  for (const { name, version } of specs.map(parseSpec)) {
    queue.push({ name, version: version ?? await latestVersion(name), direct: true });
  }
  while (queue.length) {
    const { name, version, direct: isDirect } = queue.shift();
    if (installed.has(name) || required.has(name)) {
      installed.add(name);
      continue;
    }
    let elmJson = compiler.readPackageElmJson(name, version);
    if (elmJson) {
      log2(`Using bundled ${name}@${version}`);
    } else {
      log2(`Installing ${name}@${version}\u2026`);
      const fetched = await fetchPackage(name, version, { sources, log: log2 });
      log2(`  via ${fetched.source}`);
      elmJson = fetched.elmJson;
      compiler.installPackage({ name, version, elmJson, files: fetched.files });
    }
    installed.add(name);
    if (isDirect) direct[name] = version;
    else indirect[name] = version;
    for (const [dep, constraint] of Object.entries(elmJson.dependencies || {})) {
      if (installed.has(dep) || required.has(dep)) continue;
      let depVersion = direct[dep] ?? indirect[dep];
      if (!depVersion || !satisfies(depVersion, constraint)) {
        const present = onDisk.get(dep);
        depVersion = present && satisfies(present, constraint) ? present : lowerBound(constraint);
      }
      if (!depVersion) throw new Error(`Could not resolve a version for ${dep} (${constraint})`);
      queue.push({ name: dep, version: depVersion, direct: false });
    }
  }
  const next = { ...base, dependencies: { ...base.dependencies, direct, indirect } };
  compiler.setApplicationElmJson(next);
  return next;
}

// packages/elm-wasm/src/imports.js
var stripComments = (source) => source.replace(/\{-[\s\S]*?-\}/g, " ").replace(/--[^\n]*/g, " ");
function detectImports(source) {
  const modules = /* @__PURE__ */ new Set();
  const re = /^[ \t]*import[ \t]+([A-Z][\w]*(?:\.[A-Z][\w]*)*)/gm;
  let match;
  while ((match = re.exec(stripComments(source))) !== null) modules.add(match[1]);
  return [...modules];
}
function resolveImports({ imports, available, index }) {
  const needed = [];
  const unresolved = [];
  for (const moduleName of imports) {
    if (available.has(moduleName)) continue;
    const entry = index?.[moduleName];
    if (entry) needed.push({ module: moduleName, package: entry[0], version: entry[1] });
    else unresolved.push(moduleName);
  }
  return { needed, unresolved };
}
async function autoInstallImports(compiler, source, { index, cdn: cdn2, sources = getSources(cdn2), log: log2 = () => {
} } = {}) {
  const imports = detectImports(source);
  const available = compiler.listImportableModules();
  const { needed, unresolved } = resolveImports({ imports, available, index });
  const specs = [...new Set(needed.map(({ package: pkg, version }) => `${pkg}@${version}`))];
  if (specs.length) await installPackages(compiler, specs, { sources, log: log2 });
  if (unresolved.length) log2(`Could not resolve imports: ${unresolved.join(", ")}`);
  return { imports, installed: specs, unresolved };
}

// packages/elm-wasm/src/importmap.js
var moduleToPath = (moduleName) => `src/${moduleName.split(".").join("/")}.elm`;
function parseImportMap(input) {
  const raw = typeof input === "string" ? JSON.parse(input) : input;
  const imports = raw?.imports ?? raw?.modules ?? raw;
  const entries = [];
  for (const [moduleName, value] of Object.entries(imports ?? {})) {
    if (typeof value === "string") {
      entries.push({ module: moduleName, url: value });
    } else if (value && typeof value === "object" && typeof value.url === "string") {
      entries.push({
        module: moduleName,
        url: value.url,
        package: value.package ?? value.name,
        version: value.version
      });
    }
  }
  return entries;
}
async function installFromImportMap(compiler, input, { index, cdn: cdn2, sources = getSources(cdn2), log: log2 = () => {
} } = {}) {
  const entries = Array.isArray(input) ? input : parseImportMap(input);
  const byPackage = /* @__PURE__ */ new Map();
  const unresolved = [];
  for (const entry of entries) {
    let { package: name, version } = entry;
    if (!name || !version) {
      const fromUrl = packageFromUrl(entry.url);
      name ??= fromUrl?.name;
      version ??= fromUrl?.version;
    }
    if ((!name || !version) && index?.[entry.module]) {
      [name, version] = [name ?? index[entry.module][0], version ?? index[entry.module][1]];
    }
    if (!name || !version) {
      unresolved.push(entry.module);
      continue;
    }
    const key = `${name}@${version}`;
    if (!byPackage.has(key)) byPackage.set(key, { name, version, modules: [] });
    byPackage.get(key).modules.push(entry);
  }
  const available = new Set(compiler.listPackages().map((pkg) => `${pkg.name}@${pkg.version}`));
  const installed = [...byPackage.values()].map((pkg) => `${pkg.name}@${pkg.version}`).filter((spec) => !available.has(spec));
  if (installed.length) {
    log2(`Import map: installing ${installed.join(", ")}`);
    await installPackages(compiler, installed, { sources, log: log2 });
  }
  const elmJson = JSON.parse(compiler.readText("/elm.json"));
  let changed = false;
  for (const { name, version } of byPackage.values()) {
    if (elmJson.dependencies.direct[name] !== version) {
      elmJson.dependencies.direct[name] = version;
      changed = true;
    }
  }
  if (changed) compiler.setApplicationElmJson(elmJson);
  const overridden = [];
  for (const { name, version, modules } of byPackage.values()) {
    for (const { module: moduleName, url } of modules) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const source = await res.text();
        compiler.writeFile(`/elm-home/0.19.1/packages/${name}/${version}/${moduleToPath(moduleName)}`, source);
        overridden.push(moduleName);
        log2(`Import map: ${moduleName} \u2190 ${url}`);
      } catch (err) {
        unresolved.push(moduleName);
        log2(`Import map: could not load ${moduleName} (${err.message})`);
      }
    }
  }
  return { installed, overridden, unresolved };
}

// packages/elm-wasm/assets/ulm.js
var JSValManager = class {
  #lastk = 0;
  #kv = /* @__PURE__ */ new Map();
  newJSVal(v) {
    const k = ++this.#lastk;
    this.#kv.set(k, v);
    return k;
  }
  // A separate has() call to ensure we can store undefined as a value
  // too. Also, unconditionally check this since the check is cheap
  // anyway, if the check fails then there's a use-after-free to be
  // fixed.
  getJSVal(k) {
    if (!this.#kv.has(k)) {
      throw new WebAssembly.RuntimeError(`getJSVal(${k})`);
    }
    return this.#kv.get(k);
  }
  // Check for double free as well.
  freeJSVal(k) {
    if (!this.#kv.delete(k)) {
      throw new WebAssembly.RuntimeError(`freeJSVal(${k})`);
    }
  }
};
var __elmWasmSetImmediate = null;
var resolveSetImmediate = () => {
  if (globalThis.scheduler) {
    return (cb, ...args) => scheduler.postTask(() => cb(...args));
  }
  if (globalThis.setImmediate) {
    return globalThis.setImmediate;
  }
  const sm = new SetImmediate();
  return (cb, ...args) => sm.setImmediate(cb, ...args);
};
var setImmediate = (cb, ...args) => {
  __elmWasmSetImmediate ??= resolveSetImmediate();
  return __elmWasmSetImmediate(cb, ...args);
};
var ulm_default = (__exports) => {
  const __ghc_wasm_jsffi_jsval_manager = new JSValManager();
  const __ghc_wasm_jsffi_finalization_registry = globalThis.FinalizationRegistry ? new FinalizationRegistry((sp) => __exports.rts_freeStablePtr(sp)) : { register: () => {
  }, unregister: () => true };
  return {
    newJSVal: (v) => __ghc_wasm_jsffi_jsval_manager.newJSVal(v),
    getJSVal: (k) => __ghc_wasm_jsffi_jsval_manager.getJSVal(k),
    freeJSVal: (k) => __ghc_wasm_jsffi_jsval_manager.freeJSVal(k),
    scheduleWork: () => setImmediate(__exports.rts_schedulerLoop),
    ZC0ZCghczminternalZCGHCziInternalziWasmziPrimziExportsZC: ($1, $2) => $1.reject(new WebAssembly.RuntimeError($2)),
    ZC18ZCghczminternalZCGHCziInternalziWasmziPrimziExportsZC: ($1, $2) => $1.resolve($2),
    ZC19ZCghczminternalZCGHCziInternalziWasmziPrimziExportsZC: ($1) => $1.resolve(),
    ZC20ZCghczminternalZCGHCziInternalziWasmziPrimziExportsZC: ($1) => {
      $1.throwTo = () => {
      };
    },
    ZC21ZCghczminternalZCGHCziInternalziWasmziPrimziExportsZC: ($1, $2) => {
      $1.throwTo = (err) => __exports.rts_promiseThrowTo($2, err);
    },
    ZC22ZCghczminternalZCGHCziInternalziWasmziPrimziExportsZC: () => {
      let res, rej;
      const p = new Promise((resolve, reject) => {
        res = resolve;
        rej = reject;
      });
      p.resolve = res;
      p.reject = rej;
      return p;
    },
    ZC0ZCghczminternalZCGHCziInternalziWasmziPrimziTypesZC: ($1) => `${$1.stack ? $1.stack : $1}`,
    ZC1ZCghczminternalZCGHCziInternalziWasmziPrimziTypesZC: ($1, $2) => new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(__exports.memory.buffer, $1, $2)),
    ZC2ZCghczminternalZCGHCziInternalziWasmziPrimziTypesZC: ($1, $2, $3) => new TextEncoder().encodeInto($1, new Uint8Array(__exports.memory.buffer, $2, $3)).written,
    ZC3ZCghczminternalZCGHCziInternalziWasmziPrimziTypesZC: ($1) => $1.length,
    ZC4ZCghczminternalZCGHCziInternalziWasmziPrimziTypesZC: ($1) => {
      try {
        __ghc_wasm_jsffi_finalization_registry.unregister($1);
      } catch {
      }
    },
    ZC18ZCghczminternalZCGHCziInternalziWasmziPrimziImportsZC: ($1, $2) => $1.then(() => __exports.rts_promiseResolveUnit($2), (err) => __exports.rts_promiseReject($2, err)),
    ZC0ZCghczminternalZCGHCziInternalziWasmziPrimziConcziInternalZC: async ($1) => new Promise((res) => setTimeout(res, $1 / 1e3))
  };
};

// packages/elm-wasm/src/index.js
var ElmCompileError = class extends Error {
  constructor(result) {
    const first = result?.errors?.[0]?.problems?.[0]?.title;
    super(
      result?.message ? `${result.title ?? "Elm compile error"}: ${result.message}` : `Elm compilation failed${first ? ` (${first})` : ""}`
    );
    this.name = "ElmCompileError";
    this.type = result?.type ?? "error";
    this.errors = result?.errors;
    this.result = result;
  }
};
function messageText(message) {
  if (typeof message === "string") return message;
  if (Array.isArray(message)) return message.map(messageText).join("");
  if (message && typeof message === "object") return messageText(message.string);
  return "";
}
function formatError(error) {
  const reports = Array.isArray(error) ? error : error?.errors;
  if (!Array.isArray(reports)) return String(error?.message ?? error);
  const text = reports.map((report) => {
    const header = `${report.name ?? "Elm"}${report.path ? ` (${report.path})` : ""}`;
    const problems = (report.problems ?? []).map((problem) => {
      const at = problem.region?.start ? ` at line ${problem.region.start.line}, column ${problem.region.start.column}` : "";
      return `${problem.title ?? "ERROR"}${at}
${messageText(problem.message)}`;
    });
    return [header, ...problems].join("\n\n");
  }).join("\n\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\n");
  return text || String(error?.message ?? error);
}
async function createCompiler(options = {}) {
  const log2 = options.onLog ?? (() => {
  });
  const sources = getSources(options.cdn);
  const assets = await loadAssets(options);
  const compiler = await createElmCompiler({ ...assets, jsffi: ulm_default, log: log2 });
  const state = {
    importMapKey: null,
    packagesKey: null,
    moduleIndex: null
  };
  const getIndex = async () => {
    if (!state.moduleIndex) state.moduleIndex = await loadModuleIndex(options);
    return state.moduleIndex;
  };
  const applyPackages = async (packages) => {
    if (!packages?.length) return;
    const key = JSON.stringify(packages);
    if (key === state.packagesKey) return;
    log2(`Installing ${packages.join(", ")}`);
    await installPackages(compiler, packages, { sources, log: log2 });
    state.packagesKey = key;
  };
  const applyImportMap = async (importMap) => {
    if (!importMap) return;
    const key = typeof importMap === "string" ? importMap : JSON.stringify(importMap);
    if (key === state.importMapKey) return;
    await installFromImportMap(compiler, importMap, { index: await getIndex(), sources, log: log2 });
    state.importMapKey = key;
  };
  await applyPackages(options.packages);
  await applyImportMap(options.importMap);
  return {
    /**
     * Compile one Elm module.
     *
     * @param {string} source  Elm source code
     * @param {object} [callOptions] same options as `createCompiler`, per call
     * @returns {Promise<{ js: string, name: string, map: undefined }>}
     * @throws {ElmCompileError}
     */
    async compile(source, callOptions = {}) {
      await applyPackages(callOptions.packages);
      await applyImportMap(callOptions.importMap);
      const autoInstall = callOptions.autoInstall ?? options.autoInstall ?? true;
      if (autoInstall) {
        const index = await getIndex();
        if (!index) {
          log2("No module index available \u2014 pass `moduleIndex` or `baseUrl` to enable import detection.");
        } else {
          await autoInstallImports(compiler, source, { index, sources, log: log2 });
        }
      }
      const result = await compiler.compile(source);
      if (result.type !== "success") throw new ElmCompileError(result);
      return { js: result.js, name: result.name, map: void 0 };
    },
    /** The module currently installed/exposed, useful for debugging. */
    listPackages: () => compiler.listPackages(),
    /** The modules the application can import (its `elm.json` dependencies). */
    listImportableModules: () => compiler.listImportableModules(),
    /**
     * The low-level compiler (from `createElmCompiler`). Escape hatch for
     * `installPackages` / `installFromImportMap` / `autoInstallImports`.
     */
    raw: compiler,
    /** Drop the compiler instance. */
    dispose() {
      state.moduleIndex = null;
    }
  };
}

// src/main.js
var cdn = new URLSearchParams(location.search).get("cdn") ?? void 0;
var ASSETS_BASE_URL = "./assets/";
var DEFAULT_SOURCE = `module Main exposing (main)

import Browser
import Html exposing (Html, button, div, h1, text)
import Html.Attributes exposing (style)
import Html.Events exposing (onClick)


main : Program () Int Msg
main =
    Browser.sandbox { init = 0, update = update, view = view }


type Msg
    = Increment
    | Decrement


update : Msg -> Int -> Int
update msg model =
    case msg of
        Increment ->
            model + 1

        Decrement ->
            model - 1


view : Int -> Html Msg
view model =
    div [ style "font-family" "sans-serif", style "text-align" "center" ]
        [ h1 [] [ text "Elm in the browser" ]
        , button [ onClick Decrement, style "font-size" "1.5rem" ] [ text "-" ]
        , div [ style "font-size" "2rem" ] [ text (String.fromInt model) ]
        , button [ onClick Increment, style "font-size" "1.5rem" ] [ text "+" ]
        ]
`;
var els = {
  editor: document.getElementById("editor"),
  packages: document.getElementById("packages"),
  importMap: document.getElementById("import-map"),
  run: document.getElementById("run"),
  reset: document.getElementById("reset"),
  status: document.getElementById("status"),
  output: document.getElementById("output"),
  logs: document.getElementById("logs")
};
var compilerPromise = null;
var outputUrl = null;
function log(message) {
  const line = document.createElement("div");
  line.textContent = message;
  els.logs.append(line);
  els.logs.scrollTop = els.logs.scrollHeight;
}
function setStatus(text, kind = "") {
  els.status.textContent = text;
  els.status.dataset.kind = kind;
}
function getCompiler() {
  compilerPromise ??= (async () => {
    setStatus("Loading compiler\u2026", "busy");
    const started = performance.now();
    const compiler = await createCompiler({ baseUrl: ASSETS_BASE_URL, cdn, onLog: log });
    log(`Compiler ready in ${(performance.now() - started).toFixed(0)} ms`);
    return compiler;
  })();
  return compilerPromise;
}
function showHtml(html) {
  if (outputUrl) URL.revokeObjectURL(outputUrl);
  outputUrl = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  els.output.src = outputUrl;
}
var escapeHtml = (str) => String(str).replace(
  /[&<>"']/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
);
var errorHtml = (error) => `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
body { font-family: ui-monospace, monospace; padding: 12px; color: #b00020; font-size: 13px; }
pre { white-space: pre-wrap; line-height: 1.45; }
</style></head>
<body><h2>Compilation failed</h2><pre>${escapeHtml(formatError(error))}</pre></body></html>`;
function compilerOptions() {
  const packages = (els.packages?.value.trim() ?? "").split(/[\s,]+/).filter(Boolean);
  let importMap;
  const rawImportMap = els.importMap?.value.trim();
  if (rawImportMap) {
    try {
      importMap = JSON.parse(rawImportMap);
    } catch (err) {
      throw new Error(`Import map is not valid JSON: ${err.message}`);
    }
  }
  return { packages, importMap, onLog: log };
}
async function run() {
  els.run.disabled = true;
  try {
    const compiler = await getCompiler();
    setStatus("Compiling\u2026", "busy");
    const started = performance.now();
    const { js, name } = await compiler.compile(els.editor.value, compilerOptions());
    const ms = (performance.now() - started).toFixed(0);
    log(`Compiled ${name} (${js.length} bytes of JS) in ${ms} ms`);
    setStatus(`Compiled in ${ms} ms`, "ok");
    showHtml(wrapJsInHtml(js, name));
  } catch (err) {
    if (err instanceof ElmCompileError) {
      setStatus(err.type === "compile-errors" ? "Compile errors" : "Compiler error", "error");
      log(formatError(err));
      showHtml(errorHtml(err));
    } else {
      console.error(err);
      setStatus(`Failed: ${err.message}`, "error");
      log(`Failed: ${err.stack || err.message}`);
    }
  } finally {
    els.run.disabled = false;
  }
}
els.run.addEventListener("click", run);
els.reset.addEventListener("click", () => {
  els.editor.value = DEFAULT_SOURCE;
});
els.editor.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault();
    run();
  }
});
els.editor.value = DEFAULT_SOURCE;
setStatus("Idle \u2014 press Run (or Ctrl+Enter)", "");
//# sourceMappingURL=bundle.js.map
