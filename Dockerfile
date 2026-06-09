# 1. Ñáîðêà ôðîíòåíäà
FROM node:20 AS frontend-build
WORKDIR /src/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
RUN npm run build

# 2. Ñáîðêà áýêåíäà íà .NET 8
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS backend-build
WORKDIR /src
COPY backend/backend.csproj backend/
RUN dotnet restore backend/backend.csproj
COPY backend/ backend/
# Êîïèðóåì ñîáðàííûé ôðîíòåíä â ïàïêó wwwroot áýêåíäà (÷òîáû .NET ðàçäàâàë ñòàòèêó)
COPY --from=frontend-build /src/frontend/dist /src/backend/wwwroot
RUN dotnet publish backend/backend.csproj -c Release -o /app/publish

# 3. Ôèíàëüíûé îáðàç äëÿ çàïóñêà
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=backend-build /app/publish .
# Îòêðûâàåì ïîðò 10000 äëÿ Render
ENV ASPNETCORE_URLS=http://0.0.0.0:10000
EXPOSE 10000
ENTRYPOINT ["dotnet", "backend.dll"]
