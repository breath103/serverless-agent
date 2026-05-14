#!/bin/bash
# Usage: with-env.sh [--env=<name>|-e=<name>] <command> [args...]
# Loads .env.<name> (defaults to .env.development) and runs the command

e=''
f=''
args=()

for a in "$@"; do
  case $a in
    --env=*|-e=*) e=${a#*=};;
    --file=*|-f=*) f=${a#*=};;
    *) args+=("$a");;
  esac
done

set -a
if [ -n "$f" ]; then
  source "$f"
elif [ -z "$e" ]; then
  e="development"
  source ".env.$e"
else
  source ".env.$e"
fi
set +a

exec "${args[@]}"
