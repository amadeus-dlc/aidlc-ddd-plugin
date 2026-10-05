#!/usr/bin/env bash
#
# scripts/run-takt.sh — 使う Claude・Codex のアカウントと takt の設定を固定して takt を起動する
#
# takt はグローバル層 (既定は ~/.takt) とプロジェクト層 (.takt/) の設定を重ねて読む。
# ~/.takt は他のプロジェクトが書き換えることがあり、プロファイルや companion の有効・無効が
# このリポジトリの実行へ混ざる。そのため TAKT_CONFIG_DIR をこのリポジトリの .takt/global に
# 固定し、~/.takt を読まないようにする。呼び出し元が TAKT_CONFIG_DIR を設定していても上書きする。
#
# .takt/runtime.yaml は Claude (計画・実装) と Codex (レビュー) を両方使う。takt が起動する claude と
# codex を、それぞれ指定したアカウントで動かすため、入口のスクリプトを渡す:
#   TAKT_CLAUDE_CLI_PATH=scripts/takt-claude.sh (TAKT_CLAUDE_ACCOUNT_DIR の CLAUDE_CONFIG_DIR で claude を起動)
#   TAKT_CODEX_CLI_PATH=scripts/takt-codex.sh   (TAKT_CODEX_ACCOUNT_DIR を CODEX_HOME にして codex を起動)
# 入口のスクリプトは、設定ディレクトリより優先される認証の環境変数 (CLAUDE_CODE_OAUTH_TOKEN、
# OPENAI_API_KEY など) を外してから起動する。
#
# 使い方:
#   scripts/run-takt.sh [--config-dir <dir>] [--codex-account <dir>] [--] [takt の引数...]
#
#   --config-dir を省略したときは、呼び出し元の CLAUDE_CONFIG_DIR を使う。--codex-account を
#   省略したときは、呼び出し元の TAKT_CODEX_ACCOUNT_DIR を使う。どちらかが決まらないときは、
#   どのアカウントで動くかを確かめずに走らせることになるので、エラーで止める。
#   takt の引数を省略したときは `takt run` を実行する。
#
# 例:
#   scripts/run-takt.sh --config-dir ~/.claude-ai-1@ideo-plus.jp --codex-account ~/.codex-ai-1@ideo-plus.jp        # takt run
#   scripts/run-takt.sh --config-dir ~/.claude-ai-1@ideo-plus.jp --codex-account ~/.codex-ai-1@ideo-plus.jp list   # takt list
#
# takt をこのスクリプトを通さずに直接起動すると ~/.takt が読まれる。add・list などの
# サブコマンドも、このスクリプト経由で実行すること。
#
# bash 3.2 (macOS 標準) 互換のため、配列は使用しない。
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

usage() {
  cat <<'EOF'
usage: scripts/run-takt.sh [--config-dir <dir>] [--codex-account <dir>] [--] [takt の引数...]

  --config-dir <dir>     使う Claude アカウントの設定ディレクトリ (省略時は呼び出し元の CLAUDE_CONFIG_DIR)
  --codex-account <dir>  使う Codex アカウントの設定ディレクトリ (省略時は呼び出し元の TAKT_CODEX_ACCOUNT_DIR)
  -h, --help             この説明を表示する

takt の引数を省略したときは `takt run` を実行する。
EOF
}

die() {
  printf 'error: %s\n' "$1" >&2
  exit 2
}

CONFIG_DIR="${CLAUDE_CONFIG_DIR:-}"
CODEX_ACCOUNT_DIR="${TAKT_CODEX_ACCOUNT_DIR:-}"
while [ "$#" -gt 0 ]; do
  case "$1" in
    --config-dir)
      [ "$#" -ge 2 ] || die "--config-dir には値が必要です"
      CONFIG_DIR="$2"
      shift 2
      ;;
    --config-dir=*)
      CONFIG_DIR="${1#--config-dir=}"
      shift
      ;;
    --codex-account)
      [ "$#" -ge 2 ] || die "--codex-account には値が必要です"
      CODEX_ACCOUNT_DIR="$2"
      shift 2
      ;;
    --codex-account=*)
      CODEX_ACCOUNT_DIR="${1#--codex-account=}"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    --)
      shift
      break
      ;;
    *)
      break
      ;;
  esac
done

[ -n "${CONFIG_DIR}" ] \
  || die "CLAUDE_CONFIG_DIR が決まっていません。--config-dir <dir> で使うアカウントの設定ディレクトリを指定してください"
[ -d "${CONFIG_DIR}" ] || die "設定ディレクトリが見つかりません: ${CONFIG_DIR}"
[ -n "${CODEX_ACCOUNT_DIR}" ] \
  || die "Codex のアカウントが決まっていません。--codex-account <dir> で使うアカウントの設定ディレクトリを指定してください (.takt/runtime.yaml はレビューを Codex で動かします)"
[ -d "${CODEX_ACCOUNT_DIR}" ] || die "Codex の設定ディレクトリが見つかりません: ${CODEX_ACCOUNT_DIR}"
# 相対パスで渡されても REPO_ROOT へ移動した後に解決がずれないよう、先に絶対パスにする。
CONFIG_DIR="$(cd "${CONFIG_DIR}" && pwd)"
CODEX_ACCOUNT_DIR="$(cd "${CODEX_ACCOUNT_DIR}" && pwd)"

# takt は mise.toml で固定した版を mise exec で起動する。mise が有効でないシェルや IDE から
# 呼ばれても、グローバルに入っている版では動かさない。
command -v mise >/dev/null 2>&1 || die "mise が PATH にありません (takt は mise.toml で固定した版を使います)"
TAKT_VERSION="$(mise exec -- takt --version 2>/dev/null)" || die "mise で takt を起動できません (mise install を実行してください)"
# claude-sdk プロバイダ (.takt/runtime.yaml で coder に割り当てている) は、TAKT_CLAUDE_CLI_PATH が無いと
# Claude Agent SDK に同梱された Claude Code を使う。同梱版は新しいモデルに追いつかないことがあり、
# Claude Opus 5.5 は 2.1.280 以上を要求する。そのため PATH 上の claude を確かめ、入口のスクリプトから
# それを起動させる (TAKT_CLAUDE_REAL_CLI)。
CLAUDE_CLI="$(command -v claude 2>/dev/null || true)"
[ -n "${CLAUDE_CLI}" ] || die "claude が PATH にありません (mise の設定を確認してください)"
CLAUDE_CLI_MIN_VERSION="2.1.280"
CLAUDE_CLI_VERSION="$("${CLAUDE_CLI}" --version 2>/dev/null | sed -n 's/^\([0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*\).*/\1/p' | head -1)"
[ -n "${CLAUDE_CLI_VERSION}" ] || die "claude のバージョンを取得できません: ${CLAUDE_CLI}"
# 2 つの x.y.z を数値として比べ、左が右以上なら真を返す (bash 3.2 互換のため配列を使わない)。
version_at_least() {
  local IFS=.
  # shellcheck disable=SC2086
  set -- $1 $2
  [ "$1" -gt "$4" ] && return 0; [ "$1" -lt "$4" ] && return 1
  [ "$2" -gt "$5" ] && return 0; [ "$2" -lt "$5" ] && return 1
  [ "$3" -ge "$6" ]
}
version_at_least "${CLAUDE_CLI_VERSION}" "${CLAUDE_CLI_MIN_VERSION}" \
  || die "claude ${CLAUDE_CLI_VERSION} は古すぎます。${CLAUDE_CLI_MIN_VERSION} 以上が必要です (${CLAUDE_CLI})"

# codex も PATH 上のものを確かめ、入口のスクリプトからそれを起動させる (TAKT_CODEX_REAL_CLI)。
CODEX_CLI="$(command -v codex 2>/dev/null || true)"
[ -n "${CODEX_CLI}" ] || die "codex が PATH にありません"
CODEX_CLI_VERSION="$("${CODEX_CLI}" --version 2>/dev/null | head -1)"
[ -n "${CODEX_CLI_VERSION}" ] || die "codex のバージョンを取得できません: ${CODEX_CLI}"

if [ "$#" -eq 0 ]; then
  set -- run
fi

TAKT_GLOBAL_DIR="${REPO_ROOT}/.takt/global"
[ -f "${TAKT_GLOBAL_DIR}/config.yaml" ] || die "takt のグローバル層の設定が見つかりません: ${TAKT_GLOBAL_DIR}/config.yaml"

unset CLAUDE_CODE_OAUTH_TOKEN OPENAI_API_KEY CODEX_API_KEY TAKT_OPENAI_API_KEY
export CLAUDE_CONFIG_DIR="${CONFIG_DIR}"
export TAKT_CONFIG_DIR="${TAKT_GLOBAL_DIR}"
export TAKT_CLAUDE_CLI_PATH="${REPO_ROOT}/scripts/takt-claude.sh"
export TAKT_CLAUDE_ACCOUNT_DIR="${CONFIG_DIR}"
export TAKT_CLAUDE_REAL_CLI="${CLAUDE_CLI}"
export TAKT_CODEX_CLI_PATH="${REPO_ROOT}/scripts/takt-codex.sh"
export TAKT_CODEX_ACCOUNT_DIR="${CODEX_ACCOUNT_DIR}"
export TAKT_CODEX_REAL_CLI="${CODEX_CLI}"
export CODEX_HOME="${CODEX_ACCOUNT_DIR}"

cd "${REPO_ROOT}"
printf '==> CLAUDE_CONFIG_DIR=%s (CLAUDE_CODE_OAUTH_TOKEN は unset 済み)\n' "${CLAUDE_CONFIG_DIR}"
printf '==> TAKT_CONFIG_DIR=%s (~/.takt は読まない)\n' "${TAKT_CONFIG_DIR}"
printf '==> TAKT_CLAUDE_CLI_PATH=%s (%s: %s, %s 以上)\n' "${TAKT_CLAUDE_CLI_PATH}" "${CLAUDE_CLI}" "${CLAUDE_CLI_VERSION}" "${CLAUDE_CLI_MIN_VERSION}"
printf '==> TAKT_CODEX_CLI_PATH=%s (CODEX_HOME=%s, %s: %s)\n' "${TAKT_CODEX_CLI_PATH}" "${TAKT_CODEX_ACCOUNT_DIR}" "${CODEX_CLI}" "${CODEX_CLI_VERSION}"
printf '==> takt %s (%s)\n' "$*" "${TAKT_VERSION}"
exec mise exec -- takt "$@"
