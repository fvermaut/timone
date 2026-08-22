# The box a daemon-spawned run happens in (ADR-0041).
#
# It carries node, the toolchain, `gh`, the Claude Code CLI and the browsers.
# It carries NO docker CLI and is given NO docker socket: the agent inside has
# no power to create containers, and whatever a run needs standing up is stood
# up beside it, by the daemon, before the session starts (ADR-0041 D3).
#
# The base is Playwright's own published image, so browser dependencies are the
# vendor's problem and not ours. Every version below is pinned on purpose: two
# runs started an hour apart must follow identical rules (ADR-0041 D2), and a
# floating tag makes that untrue for the image too.
FROM mcr.microsoft.com/playwright:v1.62.1-noble

ARG GH_VERSION=2.97.0
ARG CLAUDE_CODE_VERSION=2.1.238
ARG PLAYWRIGHT_VERSION=1.62.1

ENV DEBIAN_FRONTEND=noninteractive

# The toolchain. `git` is not optional decoration: cloning from the remotes is
# how this box gets its content at all.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        git \
        jq \
        openssh-client \
        unzip \
    && rm -rf /var/lib/apt/lists/*

# `gh` from the vendor's release tarball rather than the apt channel, so the
# version is a number in this file instead of whatever the channel served on
# the day of the build.
RUN arch="$(dpkg --print-architecture)" \
    && curl -fsSL -o /tmp/gh.tar.gz \
        "https://github.com/cli/cli/releases/download/v${GH_VERSION}/gh_${GH_VERSION}_linux_${arch}.tar.gz" \
    && tar -xzf /tmp/gh.tar.gz -C /tmp \
    && install -m 0755 "/tmp/gh_${GH_VERSION}_linux_${arch}/bin/gh" /usr/local/bin/gh \
    && rm -rf /tmp/gh.tar.gz "/tmp/gh_${GH_VERSION}_linux_${arch}"

RUN npm install -g "@anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}"

# The browsers are already in the base image, under /ms-playwright. What is
# missing is the library that drives them, which the check script imports and
# which a run needs when it stands a project up. Skip the browser download —
# taking a second copy would double the image for nothing.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm install --prefix /opt/timone --no-save "playwright@${PLAYWRIGHT_VERSION}"

COPY docker/image-check.mjs /opt/timone/image-check.mjs

# ---------------------------------------------------------------------------
# The box does not run as root.
#
# ✏ Added 2026-08-22, at 30j's first live run. It is not hardening for its own
# sake: the Claude CLI **refuses** `--permission-mode bypassPermissions` under
# root, and every daemon-spawned session uses it. So an image that runs as
# root is an image no session can run in, and the failure says nothing about
# containers — it says "cannot be used with root/sudo privileges".
#
# `pwuser` comes from Playwright's own base image and is what it intends
# browsers to run as. `/workspace` is where a run clones both repositories, so
# it has to exist and be his before he arrives.
# ---------------------------------------------------------------------------
RUN mkdir -p /workspace \
    && chown -R pwuser:pwuser /workspace /opt/timone

USER pwuser
WORKDIR /workspace
