#!/usr/bin/env bash
#
# Updates the live wedding site: pulls the latest code, backs up the
# database, rebuilds the containers, and checks the site is answering.
#
# Install once (see README):
#   sudo ln -s ~/Cainton/scripts/update-site.sh /usr/local/bin/updatesite
#
# Usage:
#   updatesite        # shows what's changing, asks before applying
#   updatesite -y     # skip the confirmation
#   updatesite -f     # rebuild even when there's nothing new to pull
#
set -uo pipefail

ASSUME_YES=0
FORCE=0
for arg in "$@"; do
	case "$arg" in
	-y | --yes) ASSUME_YES=1 ;;
	-f | --force) FORCE=1 ;;
	-h | --help)
		sed -n '3,12p' "$0" | sed 's/^# \{0,1\}//'
		exit 0
		;;
	*)
		echo "Unknown option: $arg (try --help)" >&2
		exit 1
		;;
	esac
done

# Colors, but only when writing to a terminal
if [ -t 1 ]; then
	BOLD=$(tput bold) DIM=$(tput dim) RED=$(tput setaf 1) GREEN=$(tput setaf 2)
	YELLOW=$(tput setaf 3) RESET=$(tput sgr0)
else
	BOLD="" DIM="" RED="" GREEN="" YELLOW="" RESET=""
fi

step() { printf '\n%s==>%s %s%s\n' "$GREEN" "$RESET" "$BOLD" "$1$RESET"; }
warn() { printf '%s!%s  %s\n' "$YELLOW" "$RESET" "$1"; }
fail() {
	printf '\n%sFailed:%s %s\n' "$RED" "$RESET" "$1" >&2
	exit 1
}

# Work from the repo root, even when called through the symlink
SCRIPT_PATH=$(readlink -f "$0")
REPO_DIR=$(cd "$(dirname "$SCRIPT_PATH")/.." && pwd)
cd "$REPO_DIR" || fail "Can't find the site directory."
[ -f docker-compose.yml ] || fail "$REPO_DIR doesn't look like the site directory."

# Deploy mode: with a DOMAIN set we run the HTTPS profile (Caddy)
PROFILE_ARGS=()
DOMAIN=""
if [ -f .env ] && grep -qE '^DOMAIN=.+' .env; then
	DOMAIN=$(grep -E '^DOMAIN=' .env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
	PROFILE_ARGS=(--profile https)
fi

step "Checking for updates"
BRANCH=$(git rev-parse --abbrev-ref HEAD)
git fetch origin "$BRANCH" --quiet || fail "Couldn't reach GitHub. Check the network and try again."

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse "origin/$BRANCH")

if [ "$LOCAL" = "$REMOTE" ]; then
	if [ "$FORCE" -eq 0 ]; then
		printf '%sAlready up to date%s — nothing to pull.\n' "$BOLD" "$RESET"
		printf '%sRun "updatesite -f" to rebuild anyway.%s\n' "$DIM" "$RESET"
		exit 0
	fi
	warn "No new commits, but rebuilding because of --force."
else
	printf '%s new commit(s) to apply:\n\n' "$(git rev-list --count HEAD.."origin/$BRANCH")"
	git --no-pager log --oneline --no-decorate HEAD.."origin/$BRANCH" | sed 's/^/  /'
fi

# Refuse to clobber uncommitted edits made directly on the server
if ! git diff --quiet || ! git diff --cached --quiet; then
	warn "You have uncommitted changes in $REPO_DIR:"
	git --no-pager status --short | sed 's/^/  /'
	warn "Pulling could overwrite them. Commit or discard first (git checkout -- <file>)."
	exit 1
fi

if [ "$ASSUME_YES" -eq 0 ]; then
	printf '\nUpdate the live site now? [y/N] '
	read -r reply </dev/tty
	case "$reply" in
	[yY] | [yY][eE][sS]) ;;
	*)
		echo "Cancelled — nothing changed."
		exit 0
		;;
	esac
fi

# The database is the irreplaceable part; keep a timestamped copy
if [ -f data/wedding.db ]; then
	step "Backing up the RSVP database"
	mkdir -p backups
	BACKUP="backups/wedding-$(date +%Y%m%d-%H%M%S).db"
	cp data/wedding.db "$BACKUP" || fail "Couldn't write the backup."
	printf 'Saved %s\n' "$BACKUP"
	# Keep the 10 most recent backups
	ls -1t backups/wedding-*.db 2>/dev/null | tail -n +11 | xargs -r rm --
fi

step "Pulling the latest code"
git pull --ff-only origin "$BRANCH" || fail "git pull failed (see the message above)."

step "Rebuilding and restarting"
docker compose "${PROFILE_ARGS[@]}" up -d --build ||
	fail "Docker build failed. If it says 'Killed', the server ran out of memory — see the swap step in the README."

step "Checking the site"
sleep 5
docker compose "${PROFILE_ARGS[@]}" ps

CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 http://127.0.0.1:3000/ || echo 000)
if [ "$CODE" = "200" ]; then
	printf '\n%sThe site is up.%s' "$GREEN$BOLD" "$RESET"
	[ -n "$DOMAIN" ] && printf ' https://%s' "$DOMAIN"
	printf '\n'
else
	warn "The app answered with HTTP $CODE — it may still be starting."
	printf '%sCheck the logs with: docker compose logs --tail 50 wedding-rsvp%s\n' "$DIM" "$RESET"
	exit 1
fi
