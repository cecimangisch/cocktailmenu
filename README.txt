CARTA DE TRAGOS LOCAL - WINDOWS
================================

1. Descomprime esta carpeta en tu PC.
2. Haz doble clic en iniciar.bat.
3. Si Windows pregunta por el firewall, permite acceso en redes privadas.
4. En esta PC abre: http://localhost:8000
5. En otro telefono conectado al mismo Wi-Fi abre:
   http://IP-DE-TU-PC:8000

PARA SABER LA IP DE TU PC
-------------------------
Abre CMD, escribe ipconfig y busca "Direccion IPv4" del adaptador Wi-Fi.
Por ejemplo, si es 192.168.1.50, la direccion sera:
http://192.168.1.50:8000

CAMBIAR LA IMAGEN
-----------------
La opcion mas facil es guardar tu carta con el nombre carta.jpg dentro de
esta carpeta. Luego abre index.html con el Bloc de notas y cambia:

  src="carta-ejemplo.svg"

por:

  src="carta.jpg"

Tambien puedes usar PNG o WEBP y poner el nombre correspondiente.

IMPORTANTE
----------
- Conviene reservar una IP fija para esta PC en el router antes de imprimir QR.
- Firewall hop: New-NetFirewallRule -DisplayName "Carta de tragos puerto 8000" -Direction Inbound -Protocol TCP -LocalPort 8000 -Action Allow -Profile Private
- IP fija: 
  En Windows ejecuta ipconfig /all.
  Busca el adaptador Wi‑Fi y anota:
  Dirección IPv4.
  Dirección física o MAC.
  Entra a la administración del router.
  Busca una opción llamada Reserva DHCP, Static Lease, Address Reservation o IP fija.
  Asocia la MAC de la PC con la IP elegida, por ejemplo 192.168.1.50.

  Después:

  La PC recibirá siempre 192.168.1.50.
  El QR apuntará a http://192.168.1.50:8000.
  Al encender la PC tendrás que volver a ejecutar iniciar.bat.
  Los visitantes deberán estar conectados al mismo Wi‑Fi.