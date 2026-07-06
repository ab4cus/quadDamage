#!/bin/bash
# Entrypoint del servidor QuadDamage. Evita el crash de Sys_ErrorDialog (xdg-open)
# en entornos headless y arranca el servidor dedicado con la auth/econ de e4Coin.
set -e
export DISPLAY=""

QD_HOME="${QD_HOME:-/home/quake/.q3a}"
mkdir -p "$QD_HOME/foobar" "${QD_ECON_SPOOL:-$QD_HOME/econ}" "${QD_TICKET_DIR:-$QD_HOME/tickets}"

# default.cfg mínimo si no existe (requisito del build standalone)
if [ ! -f "$QD_HOME/foobar/default.cfg" ]; then
  printf 'set sv_hostname "QuadDamage"\nset sv_maxclients 16\n' > "$QD_HOME/foobar/default.cfg"
fi

# Config por variables de entorno:
#   QD_AUTH=1 exige cuenta e4Coin; QD_TICKET_DIR/QD_ECON_SPOOL para los sidecars
exec quaddamage-server \
  +set fs_homepath "$QD_HOME" \
  +set dedicated 2 \
  +set net_port "${QD_PORT:-27960}" \
  +set sv_hostname "${QD_HOSTNAME:-QuadDamage}" \
  +set sv_maxclients "${QD_MAXCLIENTS:-16}" \
  +set sv_e4cauth "${QD_AUTH:-0}" \
  +set sv_e4cauthDir "${QD_TICKET_DIR:-$QD_HOME/tickets}" \
  +set sv_econSpool "${QD_ECON_SPOOL:-$QD_HOME/econ}" \
  +set com_hunkmegs 128 \
  ${QD_EXTRA_ARGS:-} \
  "$@"
