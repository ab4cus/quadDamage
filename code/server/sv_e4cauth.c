/*
===========================================================================
Quad4Damage — puente de autenticación e4Coin (lado servidor).

La CUENTA DE JUGADOR ES SU DIRECCIÓN e4Coin (L1). La verificación criptográfica
(firma del challenge con la clave e4Coin) la hace el sidecar `qd-auth` FUERA de
este binario GPL, consultando al nodo e4coind. Tras verificar, el sidecar escribe
un "token de capacidad" en un directorio spool: <spoolDir>/<spoolid>.ok con la
dirección dentro.

Este módulo NO hace crypto ni red: solo comprueba que el token existe, no ha
caducado, y lo consume (borrado = un solo uso, anti-replay). El spoolid es
sha256(ticket) generado por el sidecar con entropía HMAC: es infalsificable.

Fase 4: se sustituye la comprobación por fichero por un socket local al Oracle
(Rust) que además reenvía los eventos económicos. Ver PLAN-UNIFICADO.md §5.
===========================================================================
*/

#include "server.h"

/* Los cvars sv_e4cauth / sv_e4cauthDir se definen en sv_main.c y se declaran
   extern en server.h; aqui solo se usan. */

/*
==================
SV_E4CAuth_ValidSpoolId
Solo hex de 64 chars: evita path traversal y entradas basura.
==================
*/
static qboolean SV_E4CAuth_ValidSpoolId( const char *id ) {
	int len = 0;
	if ( !id || !*id ) return qfalse;
	for ( ; *id; id++, len++ ) {
		if ( len >= 64 ) return qfalse;
		if ( !( ( *id >= '0' && *id <= '9' ) || ( *id >= 'a' && *id <= 'f' ) ) )
			return qfalse;
	}
	return ( len >= 16 );
}

/*
==================
SV_E4CAuth_Check

Valida el ticket que el cliente pasa en el userinfo ("e4cticket" = spoolid).
Si es válido, copia la dirección e4Coin verificada en addrOut y consume el token.
Devuelve qtrue si el acceso está permitido.

Cuando sv_e4cauth es 0, siempre permite (modo compatible con clientes clásicos).
==================
*/
qboolean SV_E4CAuth_Check( const char *e4cticket, char *addrOut, int addrOutSize ) {
	char path[MAX_OSPATH];
	char line[256];
	FILE *fp;
	long expires, now;

	if ( addrOut && addrOutSize > 0 ) addrOut[0] = '\0';

	if ( !sv_e4cauth || sv_e4cauth->integer == 0 )
		return qtrue; /* auth desactivada: servidor abierto */

	if ( !SV_E4CAuth_ValidSpoolId( e4cticket ) ) {
		Com_DPrintf( "E4CAuth: ticket con formato invalido\n" );
		return qfalse;
	}

	Com_sprintf( path, sizeof( path ), "%s/%s.ok", sv_e4cauthDir->string, e4cticket );
	fp = fopen( path, "r" );
	if ( !fp ) {
		Com_DPrintf( "E4CAuth: ticket no encontrado en spool\n" );
		return qfalse;
	}

	/* linea 1: direccion e4Coin ; linea 2: epoch de expiracion */
	line[0] = '\0';
	if ( !fgets( line, sizeof( line ), fp ) ) { fclose( fp ); return qfalse; }
	{
		size_t n = strlen( line );
		while ( n > 0 && ( line[n-1] == '\n' || line[n-1] == '\r' ) ) line[--n] = '\0';
	}
	if ( addrOut && addrOutSize > 0 )
		Q_strncpyz( addrOut, line, addrOutSize );

	expires = 0;
	if ( fgets( line, sizeof( line ), fp ) )
		expires = atol( line );
	fclose( fp );

	now = (long)time( NULL );
	if ( expires != 0 && now > expires ) {
		Com_DPrintf( "E4CAuth: ticket caducado\n" );
		remove( path );
		return qfalse;
	}

	/* un solo uso: consumir el token para impedir replay */
	remove( path );

	Com_Printf( "E4CAuth: conexion autenticada como %s\n", addrOut ? addrOut : "?" );
	return qtrue;
}
