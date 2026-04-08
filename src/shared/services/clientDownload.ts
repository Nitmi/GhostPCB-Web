const CLIENT_UPDATE_ENDPOINTS = [
  "https://gh.123778.xyz/GhostPCB/releases/latest/download/latest.json",
  "https://github.com/Nitmi/GhostPCB/releases/latest/download/latest.json",
  "https://gh-proxy.org/https://github.com/Nitmi/GhostPCB/releases/latest/download/latest.json",
  "https://hk.gh-proxy.org/https://github.com/Nitmi/GhostPCB/releases/latest/download/latest.json",
  "https://edgeone.gh-proxy.org/https://github.com/Nitmi/GhostPCB/releases/latest/download/latest.json",
] as const;

type PlatformManifest = {
  url: string;
  signature?: string;
};

type LatestManifest = {
  version: string;
  notes?: string;
  pub_date?: string;
  platforms: Record<string, PlatformManifest>;
};

type ClientPlatformTarget = {
  label: string;
  keys: string[];
};

function getClientPlatformTarget(): ClientPlatformTarget | null {
  const userAgent = navigator.userAgent.toLowerCase();

  if (userAgent.includes("win")) {
    return {
      label: "Windows",
      keys: ["windows-x86_64-nsis", "windows-x86_64"],
    };
  }

  if (userAgent.includes("mac")) {
    return {
      label: "macOS",
      keys: ["darwin-aarch64-app", "darwin-aarch64"],
    };
  }

  if (userAgent.includes("linux")) {
    return {
      label: "Linux",
      keys: ["linux-x86_64-appimage", "linux-x86_64-deb", "linux-x86_64"],
    };
  }

  return null;
}

function validateManifest(value: unknown): LatestManifest {
  if (
    !value ||
    typeof value !== "object" ||
    !("platforms" in value) ||
    !value.platforms ||
    typeof value.platforms !== "object"
  ) {
    throw new Error("客户端更新清单格式无效。");
  }

  return value as LatestManifest;
}

async function fetchManifest(
  endpoint: string,
  timeoutMs: number,
): Promise<LatestManifest> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`请求失败: ${response.status}`);
    }

    const manifest = validateManifest(await response.json());
    return manifest;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function openDownloadUrl(url: string) {
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noreferrer";
  document.body.append(link);
  link.click();
  link.remove();
}

export async function downloadGhostPcbClient() {
  const platformTarget = getClientPlatformTarget();

  if (!platformTarget) {
    openDownloadUrl("https://github.com/Nitmi/GhostPCB/releases/latest");
    return;
  }

  const failures: string[] = [];

  for (const endpoint of CLIENT_UPDATE_ENDPOINTS) {
    try {
      const manifest = await fetchManifest(endpoint, 4500);
      const platformEntry = platformTarget.keys
        .map((key) => manifest.platforms[key])
        .find((entry) => Boolean(entry?.url));

      if (!platformEntry?.url) {
        failures.push(`${platformTarget.label} 安装包不存在`);
        continue;
      }

      openDownloadUrl(platformEntry.url);
      return;
    } catch (error) {
      const reason = error instanceof Error ? error.message : "未知错误";
      failures.push(reason);
    }
  }

  throw new Error(
    failures[failures.length - 1] ?? "客户端下载地址暂时不可用。",
  );
}
