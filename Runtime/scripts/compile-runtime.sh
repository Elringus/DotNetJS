cd ..
printf "Removing previous installation...\n"
rm -rf runtime
mkdir runtime
printf "Downloading the runtime sources...\n"
# The fork modifies emscripten compilation flags to support UMD.
curl -L https://github.com/Elringus/DotNetUMD/archive/release/6.0.tar.gz | tar xz -C "./runtime" --strip-components=1
printf "Compiling native modules. Initial run will take a while...\n"
source ./emsdk/emsdk_env.sh
./runtime/build.sh mono+libs -os Browser -c Release
# Strip require() statements from the autogenerated js wrapper. They're not actually executed, but webpack insists.
sed -i "s/require([^)]*./{}/g" "./runtime/artifacts/bin/native/net6.0-Browser-Release-wasm/dotnet.js"
read -p "Press Enter key to exit..."
