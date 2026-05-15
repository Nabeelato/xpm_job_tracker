const http = require("http");
const next = require("next");

const port = Number.parseInt(process.env.PORT || "3000", 10);
const hostname = process.env.HOST || "0.0.0.0";
const defaultAllowedHosts = "localhost,127.0.0.1,[::1]";
const allowedHosts = parseAllowedHosts(process.env.ALLOWED_HOSTS || defaultAllowedHosts);
const app = next({ dev: false, hostname, port });
const handle = app.getRequestHandler();

function parseAllowedHosts(value) {
  return value
    .split(",")
    .map((host) => normalizeAllowedHost(host))
    .filter(Boolean);
}

function normalizeAllowedHost(value) {
  let host = value.trim().toLowerCase();

  if (!host) {
    return "";
  }

  if (host === "*") {
    return "*";
  }

  if (host.startsWith(".")) {
    const suffix = normalizeHost(host.slice(1));
    return suffix ? `.${suffix}` : "";
  }

  if (host.startsWith("http://") || host.startsWith("https://")) {
    try {
      host = new URL(host).host;
    } catch {
      return "";
    }
  }

  return normalizeHost(host);
}

function normalizeHost(value) {
  const host = value.trim().toLowerCase();

  if (!host || /[\s/@]/.test(host) || host.includes("://")) {
    return "";
  }

  if (host.startsWith("[")) {
    const closingBracket = host.indexOf("]");

    if (closingBracket === -1) {
      return "";
    }

    const ipv6Host = host.slice(1, closingBracket);
    const remainder = host.slice(closingBracket + 1);

    if (remainder && !/^:\d+$/.test(remainder)) {
      return "";
    }

    return ipv6Host.replace(/\.$/, "");
  }

  const colonCount = (host.match(/:/g) || []).length;

  if (colonCount > 1) {
    return host.replace(/\.$/, "");
  }

  if (colonCount === 1) {
    const [hostnameOnly, portValue] = host.split(":");

    if (!hostnameOnly || !/^\d+$/.test(portValue)) {
      return "";
    }

    return hostnameOnly.replace(/\.$/, "");
  }

  return host.replace(/\.$/, "");
}

function isHostAllowed(hostHeader) {
  const requestHost = normalizeHost(hostHeader || "");

  if (!requestHost) {
    return false;
  }

  return allowedHosts.some((allowedHost) => {
    if (allowedHost === "*") {
      return true;
    }

    if (allowedHost.startsWith(".")) {
      const suffix = allowedHost.slice(1);
      return requestHost === suffix || requestHost.endsWith(`.${suffix}`);
    }

    return requestHost === allowedHost;
  });
}

app
  .prepare()
  .then(() => {
    const server = http.createServer((req, res) => {
      if (!isHostAllowed(req.headers.host)) {
        res.statusCode = 403;
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.end("Forbidden");
        return;
      }

      const start = Date.now();
      res.on("finish", () => {
        const ms = Date.now() - start;
        console.log(`${req.method} ${req.url} ${res.statusCode} ${ms}ms`);
      });

      handle(req, res);
    });

    server.listen(port, hostname, () => {
      console.log(`TI Job Management System ready on http://${hostname}:${port}`);
      console.log(`Allowed hosts: ${allowedHosts.join(", ")}`);
    });
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
