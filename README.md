# Simrep

Simrep is a **sim**ple **rep**ository service. It is aim for single hobbyists or
small startups/teams which don't need huge alternatives and for on-prem needs.

## Features

* Intented for private use ;
* No database and no UI ;
* A single secret key for uploading and a single secret key for downloading.

## Installation

Download the latest release from the releases page and put it in a folder where
your files and data will be stored.

## Configuration

You can configure simrep by three ways:

### Environnment variables

* `PORT` is the port number simrep will listen ;
* `PROXY` unused for now, is passed to [express trust proxy setting](https://expressjs.com/en/guide/behind-proxies.html) ;
* `SECRET_UPLOADER` is the secret key for uploading and downloading files ;
* `SECRET_DOWNLOADER` is the secret key for only downloading files;

### `.env` file

Create a `.env` files in the same folder as the simrep binary and edit it with
the same variable as the environment ones like this:

```
PORT=3100
SECRET_UPLOADER=your_secret_key
SECRET_DOWNLOADER=your_secret_key
```

## Usage

Starts the server with `./simrep`. Use a `systemd` script, `PM2` or an
equivalent to manage the life of simrep. Achieve HTTPS and/or logs with a
reverse proxy like nginx or caddy.

## API

All calls must provide a key in the `key` query parameters in the url. For
example: `http://localhost/api/upload?key=myKey`. The server responds in JSON
with a structure similar to the [Google Style Guide](https://google.github.io/styleguide/jsoncstyleguide.xml),
following the `apiVersion`, `context` and `error` properties and *some* others.

### `POST /api/upload`

Uploads a new file in the repository. Need the `SECRET_UPLOADER` key.

* Must be in `multipart/form-data` ;
* Body should have a `project`, `filename` and `file` fields:
  * `project` is the name of your project ;
  * `filename` is the name of your file on the server ;
  * `file` is your file.
* `project` and `filename` should only contains `a-zA-Z0-9.-_` characters ;

### `GET /api/projects`

Returns a list of all projects. Example of response:

```json
{
    "apiVersion": "1.0",
    "data": {
        "kind": "projects",
        "totalItems": 3,
        "currentItemCount": 3,
        "items": [
            "project1",
            "project2",
            "superProject"
        ]
    }
}
```

### `GET /api/[project]/list`

Lists all files for a project. Example of response:

```json
{
    "apiVersion": "1.0",
    "data": {
        "kind": "files",
        "totalItems": 3,
        "currentItemCount": 3,
        "items": [
            "latest.zip",
            "project-1.0.0.zip",
            "project-1.0.1-amd64.exe"
        ]
    }
}
```

### `GET /[project]/[file]`

Downloads a file.