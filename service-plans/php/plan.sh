pkg_name=php
pkg_distname=php
pkg_origin=emergence
pkg_version=7.1.4
pkg_maintainer="The Habitat Maintainers <humans@habitat.sh>"
pkg_license=('PHP-3.01')
pkg_upstream_url=http://php.net/
pkg_description="PHP is a popular general-purpose scripting language that is especially suited to web development."
pkg_source=https://php.net/get/${pkg_distname}-${pkg_version}.tar.bz2/from/this/mirror
pkg_filename=${pkg_distname}-${pkg_version}.tar.bz2
pkg_dirname=${pkg_distname}-${pkg_version}
pkg_shasum=39bf697836e2760b3a44ea322e9e5f1f5b1f07abeb0111f6495eff7538e25805
pkg_deps=(
  core/coreutils
  core/curl
  core/glibc
  core/libxml2
  core/libjpeg-turbo
  core/libpng
  core/openssl
  core/zlib
)
pkg_build_deps=(
  core/autoconf
  core/bison2
  core/gcc
  core/make
  core/re2c
  core/readline
)
pkg_bin_dirs=(bin sbin)
pkg_lib_dirs=(lib)
pkg_include_dirs=(include)
pkg_interpreters=(bin/php)

apcu_version=5.1.8
apcu_source=https://github.com/krakjoe/apcu/archive/v${apcu_version}.tar.gz
apcu_filename=apcu-${apcu_version}.tar.gz
apcu_shasum=09848619674a0871053cabba3907d2aade395772d54464d3aee45f519e217128
apcu_dirname=apcu-${apcu_version}

do_download() {
  do_default_download

  download_file $apcu_source $apcu_filename $apcu_shasum
}

do_verify() {
  do_default_verify

  verify_file $apcu_filename $apcu_shasum
}

do_unpack() {
  do_default_unpack

  unpack_file $apcu_filename
  mv "$HAB_CACHE_SRC_PATH/$apcu_dirname" "$HAB_CACHE_SRC_PATH/$pkg_dirname/ext/apcu"
}

do_build() {
  rm aclocal.m4
  ./buildconf --force

  ./configure --prefix="$pkg_prefix" \
    --enable-exif \
    --enable-fpm \
    --with-fpm-user=hab \
    --with-fpm-group=hab \
    --with-readline="$(pkg_path_for readline)" \
    --with-gettext="$(pkg_path_for glibc)" \
    --enable-apcu \
    --enable-mbstring \
    --enable-opcache \
    --with-mysqli=mysqlnd \
    --with-pdo-mysql=mysqlnd \
    --with-curl="$(pkg_path_for curl)" \
    --with-gd \
    --with-jpeg-dir="$(pkg_path_for libjpeg-turbo)" \
    --with-libxml-dir="$(pkg_path_for libxml2)" \
    --with-openssl="$(pkg_path_for openssl)" \
    --with-png-dir="$(pkg_path_for libpng)" \
    --with-xmlrpc \
    --with-zlib="$(pkg_path_for zlib)"
  make
}

do_install() {
  do_default_install

  # Modify PHP-FPM config so it will be able to run out of the box. To run a real
  # PHP-FPM application you would want to supply your own config with
  # --fpm-config <file>.
  mv "$pkg_prefix/etc/php-fpm.conf.default" "$pkg_prefix/etc/php-fpm.conf"
}

do_check() {
  make test
}
