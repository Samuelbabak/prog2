/* GLOBAL CONSTANTS AND VARIABLES */

/* assignment specific globals */
const WIN_Z = 0;  // default graphics window z coord in world space
const WIN_LEFT = 0; const WIN_RIGHT = 1;  // default left and right x coords in world space
const WIN_BOTTOM = 0; const WIN_TOP = 1;  // default top and bottom y coords in world space
const INPUT_TRIANGLES_URL = "https://ncsucgclass.github.io/prog2/triangles.json"; // triangles file loc
const INPUT_SPHERES_URL = "https://ncsucgclass.github.io/prog2/spheres.json"; // spheres file loc
const INPUT_CUSTOM_URL = "custom.json"; 
var Eye = new vec4.fromValues(0.5,0.5,-0.5,1.0); // default eye position in world space
/* webgl globals */
var gl = null; // the all powerful gl object. It's all here folks!
var vertexBuffer; // this contains vertex coordinates in triples
var triangleBuffer; // this contains indices into vertexBuffer in triples
var triBufferSize = 0; // the number of indices in the triangle buffer
var vertexPositionAttrib; // where to put position for vertex shader
var colorBuffer; // this contains vertex colors



function vars() {
    /* webgl globals */
    gl = null; // the all powerful gl object. It's all here folks!
    vertexBuffer = null; // clear vertex coordinates buffer
    triangleBuffer = null; // clear indices buffer
    triBufferSize = 0; // reset the number of indices in the triangle buffer
    vertexPositionAttrib = null; // clear position attribute for vertex shader
    colorBuffer = null; // clear vertex colors buffer
}


// ASSIGNMENT HELPER FUNCTIONS

// get the JSON file from the passed URL
function getJSONFile(url,descr) {
    try {
        if ((typeof(url) !== "string") || (typeof(descr) !== "string"))
            throw "getJSONFile: parameter not a string";
        else {
            var httpReq = new XMLHttpRequest(); // a new http request
            httpReq.open("GET",url,false); // init the request
            httpReq.send(null); // send the request
            var startTime = Date.now();
            while ((httpReq.status !== 200) && (httpReq.readyState !== XMLHttpRequest.DONE)) {
                if ((Date.now()-startTime) > 3000)
                    break;
            } // until its loaded or we time out after three seconds
            if ((httpReq.status !== 200) || (httpReq.readyState !== XMLHttpRequest.DONE))
                throw "Unable to open "+descr+" file!";
            else
                return JSON.parse(httpReq.response); 
        } // end if good params
    } // end try    
    
    catch(e) {
        console.log(e);
        return(String.null);
    }
} // end get input spheres

// set up the webGL environment
function setupWebGL() {

    // Get the canvas and context
    var canvas = document.getElementById("myWebGLCanvas"); // create a js canvas
    gl = canvas.getContext("webgl"); // get a webgl object from it
    
    try {
      if (gl == null) {
        throw "unable to create gl context -- is your browser gl ready?";
      } else {
        gl.clearColor(0.0, 0.0, 0.0, 1.0); // use black when we clear the frame buffer
        gl.clearDepth(1.0); // use max when we clear the depth buffer
        gl.enable(gl.DEPTH_TEST); // use hidden surface removal (with zbuffering)
      }
    } // end try
    
    catch(e) {
      console.log(e);
    } // end catch
 
} // end setupWebGL

// read triangles in, load them into webgl buffers
function loadTriangles(input) {
    var inputTriangles = getJSONFile(input, "triangles");

    if (inputTriangles != String.null) {
        var whichSetVert; // index of vertex in current triangle set
        var whichSetTri; // index of triangle in current triangle set
        var coordArray = []; // array of vertex coords for WebGL
        var indexArray = []; // array of vertex indices for WebGL
        var vtxBufferSize = 0; // the number of vertices in the vertex buffer
        var vtxToAdd = []; // vtx coords to add to the coord array
        var indexOffset = vec3.create(); // the index offset to add to the index array
        var triToAdd = vec3.create(); // the index offsets to add to the triangle array
        var colors = []; // create a color array

        for (var whichSet = 0; whichSet < inputTriangles.length; whichSet++) {
            vec3.set(indexOffset, vtxBufferSize, vtxBufferSize, vtxBufferSize); // update vertex offset

            // set up the vertex coord array
            for (whichSetVert = 0; whichSetVert < inputTriangles[whichSet].vertices.length; whichSetVert++) {
                vtxToAdd = inputTriangles[whichSet].vertices[whichSetVert];
                coordArray.push(vtxToAdd[0], vtxToAdd[1], vtxToAdd[2]);
            } // end for vertices in set

            // set up the triangle index array, adjusting indices across sets
            for (whichSetTri = 0; whichSetTri < inputTriangles[whichSet].triangles.length; whichSetTri++) {
                vec3.add(triToAdd, indexOffset, inputTriangles[whichSet].triangles[whichSetTri]);
                indexArray.push(triToAdd[0], triToAdd[1], triToAdd[2]);
            } // end for triangles in set

            var material = inputTriangles[whichSet].material;
            var diffuseColor = material.diffuse;

            for (var whichSetVert = 0; whichSetVert < inputTriangles[whichSet].vertices.length; whichSetVert++) {
                colors.push(diffuseColor[0], diffuseColor[1], diffuseColor[2]); // use diffuse color for each vertex 
            }

            vtxBufferSize += inputTriangles[whichSet].vertices.length; // total number of vertices
            triBufferSize += inputTriangles[whichSet].triangles.length; // total number of tris
        } // end for each triangle set
        triBufferSize *= 3; // now total number of indices

        // console.log("coordinates:" + coordArray.toString());
        // console.log("numVerts:" + vtxBufferSize);
        // console.log("indices:" + indexArray.toString());
        // console.log("numIndices:" + triBufferSize);

        // send the vertex coords to WebGL
        vertexBuffer = gl.createBuffer(); // init empty vertex coord buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer); // activate that buffer
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(coordArray), gl.STATIC_DRAW); // coords to that buffer

        // send the vertex colors to WebGL
        colorBuffer = gl.createBuffer(); // init empty vertex color buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer); // activate that buffer
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW); // colors to that buffer

        // send the triangle indices to WebGL
        // send the triangle indices to WebGL
        triangleBuffer = gl.createBuffer(); // init empty triangle index buffer
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffer); // activate that buffer
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indexArray), gl.STATIC_DRAW); // indices to that buffer
    } // end if triangles found
} // end load triangles


function setupShaders() {
    var fShaderCode = `
        precision mediump float;
        varying vec3 fragColor;
        void main(void) {
            gl_FragColor = vec4(fragColor, 1.0); // set fragment color
        }
    `;
    
    var vShaderCode = `
        attribute vec3 vertexPosition;
        attribute vec3 vertexColor;
        varying vec3 fragColor;

        void main(void) {
            gl_Position = vec4(vertexPosition, 1.0); // use the untransformed position
            fragColor = vertexColor;  
        }
    `;
    
    try {
        // Create and compile the fragment shader
        var fShader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fShader, fShaderCode);
        gl.compileShader(fShader);
        if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) {
            console.error("Fragment shader compile error: " + gl.getShaderInfoLog(fShader));
            gl.deleteShader(fShader);
            return;
        }

        // Create and compile the vertex shader
        var vShader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vShader, vShaderCode);
        gl.compileShader(vShader);
        if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) {
            console.error("Vertex shader compile error: " + gl.getShaderInfoLog(vShader));
            gl.deleteShader(vShader);
            return;
        }

        // Create and link the shader program
        var shaderProgram = gl.createProgram();
        gl.attachShader(shaderProgram, fShader);
        gl.attachShader(shaderProgram, vShader);
        gl.linkProgram(shaderProgram);

        // Check if program linking was successful
        if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
            console.error("Shader program linking error: " + gl.getProgramInfoLog(shaderProgram));
            return;
        }

        // Use the shader program
        gl.useProgram(shaderProgram);

        // Get and enable attribute locations
        vertexPositionAttrib = gl.getAttribLocation(shaderProgram, "vertexPosition");
        if (vertexPositionAttrib === -1) {
            console.error("Could not get attribute location for vertexPosition");
        }
        gl.enableVertexAttribArray(vertexPositionAttrib);

        vertexColorAttrib = gl.getAttribLocation(shaderProgram, "vertexColor");
        if (vertexColorAttrib === -1) {
            console.error("Could not get attribute location for vertexColor");
        }
        gl.enableVertexAttribArray(vertexColorAttrib);

    } catch(e) {
        console.log(e);
    }
}

function renderTriangles() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); // clear frame and depth buffers

    // Bind the vertex buffer and set up vertex attribute pointer
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.vertexAttribPointer(vertexPositionAttrib, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vertexPositionAttrib); // Enable vertex attribute

    // Bind the color buffer and set up color attribute pointer
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.vertexAttribPointer(vertexColorAttrib, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vertexColorAttrib); // Enable color attribute

    // Bind the triangle index buffer and render
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffer);
    gl.drawElements(gl.TRIANGLES, triBufferSize, gl.UNSIGNED_SHORT, 0);
}

var image = 0;

// Listen for user clicking space
window.addEventListener("keydown", function(event) {
    if (event.code === "Space") {
        vars();
        if (image == 0) {
            setupWebGL(); // set up the webGL environment
            loadTriangles(INPUT_CUSTOM_URL);
            setupShaders(); // setup the webGL shaders
            renderTriangles(); // draw the triangles using webGL
            image = 1;
        } else {
            setupWebGL(); // set up the webGL environment
            loadTriangles(INPUT_TRIANGLES_URL);
            setupShaders(); // setup the webGL shaders
            renderTriangles(); // draw the triangles using webGL
            image = 0;
        }
    }
});

/* MAIN -- HERE is where execution begins after window load */

function main() {
  

  setupWebGL(); // set up the webGL environment
  loadTriangles(INPUT_TRIANGLES_URL); // load in the triangles from tri file
  setupShaders(); // setup the webGL shaders
  renderTriangles(); // draw the triangles using webGL
  
} // end main

