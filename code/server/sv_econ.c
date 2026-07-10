/*
===========================================================================
Quad4Damage — emisión de eventos económicos (Tier 0 server-authoritative).

El game server es la fuente de máxima confianza de eventos económicos (kills,
victorias, capturas). Este módulo expone SV_EconEvent(), que el mod (game)
invoca a través del trap `Trap_EconEvent`, y también un comando de servidor
"econevent" para pruebas/rcon.

El evento se escribe como un fichero .evt (JSON) en el spool que vigila el
sidecar `qd-oracle`, el cual firma la sesión con la clave del servidor y la
envía a SessionOracle en la L2 (→ mint de ResourceNFT). El engine (GPL) NO
hace crypto, red ni firma: solo deposita el evento. Aislamiento de licencia y
de latencia (el game loop no se bloquea).

Fase 4 de PLAN-UNIFICADO.md §5. En producción el spool se sustituye por un
socket local al Oracle (Rust).
===========================================================================
*/

#include "server.h"

/* sv_econSpool se define en sv_main.c y se declara extern en server.h. */

/*
==================
SV_Econ_SafeToken
Sanitiza un token para JSON: solo alfanumerico, guion y guion bajo.
==================
*/
static void SV_Econ_SafeToken( const char *in, char *out, int outSize ) {
	int i = 0;
	if ( outSize <= 0 ) return;
	for ( ; in && *in && i < outSize - 1; in++ ) {
		char c = *in;
		if ( ( c >= 'a' && c <= 'z' ) || ( c >= 'A' && c <= 'Z' ) ||
		     ( c >= '0' && c <= '9' ) || c == '-' || c == '_' )
			out[i++] = c;
	}
	out[i] = '\0';
}

/*
==================
SV_EconEvent

Deposita un evento economico en el spool. addr = direccion e4Coin del jugador
(la cuenta, ver sv_e4cauth.c). resource/rarity son tipos de recurso del juego.
Devuelve qtrue si se escribio.
==================
*/
qboolean SV_EconEvent( const char *e4cAddr, const char *resource, int amount, const char *rarity ) {
	char safeAddr[64], safeRes[64], safeRar[32];
	char path[MAX_OSPATH];
	char json[512];
	FILE *fp;

	if ( !sv_econSpool || !sv_econSpool->string[0] ) {
		Com_DPrintf( "SV_EconEvent: sv_econSpool no configurado\n" );
		return qfalse;
	}
	if ( !e4cAddr || !e4cAddr[0] || !resource || !resource[0] ) return qfalse;
	if ( amount <= 0 ) return qfalse;

	SV_Econ_SafeToken( e4cAddr, safeAddr, sizeof( safeAddr ) );
	SV_Econ_SafeToken( resource, safeRes, sizeof( safeRes ) );
	SV_Econ_SafeToken( rarity && rarity[0] ? rarity : "common", safeRar, sizeof( safeRar ) );
	if ( !safeAddr[0] || !safeRes[0] ) return qfalse;

	Com_sprintf( json, sizeof( json ),
		"{\"player\":\"%s\",\"resourceType\":\"%s\",\"amount\":%d,\"rarity\":\"%s\"}\n",
		safeAddr, safeRes, amount, safeRar );

	/* nombre unico: <tiempo>-<contador> */
	{
		static int seq = 0;
		Com_sprintf( path, sizeof( path ), "%s/%d-%d.evt",
			sv_econSpool->string, (int)time( NULL ), seq++ );
	}

	fp = fopen( path, "w" );
	if ( !fp ) {
		Com_Printf( "SV_EconEvent: no se pudo escribir el spool %s\n", path );
		return qfalse;
	}
	fputs( json, fp );
	fclose( fp );
	Com_DPrintf( "SV_EconEvent: %s +%d %s (%s)\n", safeAddr, amount, safeRes, safeRar );
	return qtrue;
}

/*
==================
SV_Econ_f
Comando de servidor / rcon para emitir un evento (pruebas y disparadores manuales):
   econevent <e4cAddr> <resource> <amount> [rarity]
==================
*/
void SV_Econ_f( void ) {
	if ( Cmd_Argc() < 4 ) {
		Com_Printf( "uso: econevent <e4cAddr> <resource> <amount> [rarity]\n" );
		return;
	}
	if ( SV_EconEvent( Cmd_Argv( 1 ), Cmd_Argv( 2 ), atoi( Cmd_Argv( 3 ) ),
	                   Cmd_Argc() > 4 ? Cmd_Argv( 4 ) : "common" ) )
		Com_Printf( "econevent emitido\n" );
	else
		Com_Printf( "econevent FALLO\n" );
}
