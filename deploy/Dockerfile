# QuadDamage — servidor dedicado standalone. Build multi-stage desde fuente.
#   docker build -f deploy/Dockerfile -t ab4cus/quaddamage-server:latest .
# ------------------------------------------------------------------------------
FROM ubuntu:24.04 AS build

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential cmake pkg-config libsdl2-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /src
COPY . /src

# Servidor dedicado headless, standalone (sin assets de Quake 3), con game libs.
RUN cmake -S . -B build \
      -DCMAKE_BUILD_TYPE=Release \
      -DBUILD_SERVER=ON -DBUILD_CLIENT=OFF \
      -DBUILD_RENDERER_GL1=OFF -DBUILD_RENDERER_GL2=OFF \
      -DBUILD_GAME_LIBRARIES=ON -DBUILD_GAME_QVMS=OFF \
      -DBUILD_STANDALONE=ON && \
    cmake --build build -j"$(nproc)" && \
    strip build/Release/ioq3ded

# ------------------------------------------------------------------------------
FROM ubuntu:24.04 AS runtime

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
      libstdc++6 libgcc-s1 ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && useradd -r -m -d /home/quake -s /usr/sbin/nologin quake

COPY --from=build /src/build/Release/ioq3ded /usr/local/bin/quaddamage-server
COPY deploy/quaddamage-entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# basegame standalone + default.cfg mínimo (necesario para arrancar sin assets Q3)
RUN mkdir -p /home/quake/.q3a/foobar && \
    printf 'set sv_hostname "QuadDamage"\nset sv_maxclients 16\n' > /home/quake/.q3a/foobar/default.cfg && \
    chown -R quake:quake /home/quake

USER quake
ENV QD_HOME=/home/quake/.q3a QD_ECON_SPOOL=/home/quake/.q3a/econ QD_TICKET_DIR=/home/quake/.q3a/tickets
VOLUME ["/home/quake/.q3a"]

EXPOSE 27960/udp

ENTRYPOINT ["entrypoint.sh"]
