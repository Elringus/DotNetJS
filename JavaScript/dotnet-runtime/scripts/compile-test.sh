# dotnet workload install wasm-tools --source https://api.nuget.org/v3/index.json
dotnet build ../../../DotNet/DotNetJS.sln
dotnet publish ../test/project/Test.csproj #-fl -flp:logfile=Build.log;verbosity=diagnostic
read -r -p "Press Enter key to exit..."
