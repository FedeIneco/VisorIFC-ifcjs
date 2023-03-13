import {
  AmbientLight,
  AxesHelper,
  DirectionalLight,
  GridHelper,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
  Raycaster,
  Vector2,
  MeshLambertMaterial,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { IFCLoader } from "web-ifc-three/IFCLoader";
import {
  acceleratedRaycast,
  computeBoundsTree,
  disposeBoundsTree,
} from "three-mesh-bvh";
let ifcFileLocation = "";
let modelID = 0;
const ifcapi = new IfcAPI();
import { IfcAPI } from "web-ifc/web-ifc-api";

ifcapi.SetWasmPath("wasm/");
// import {
//   IFCWALLSTANDARDCASE,
//   IFCSLAB,
//   IFCDOOR,
//   IFCWINDOW,
//   IFCFURNISHINGELEMENT,
//   IFCMEMBER,
//   IFCPLATE,
//   IFCSITE,
//   IFCBUILDINGSTOREY,
// } from "web-ifc";

//Crear la escena
const scene = new Scene();

//Objeto para almacenar el tamaño de la ventana gráfica
const size = {
  width: window.innerWidth,
  height: window.innerHeight,
};

//Crea la cámara (punto de vista del usuario)
const camera = new PerspectiveCamera(75, size.width / size.height);
camera.position.z = 15;
camera.position.y = 13;
camera.position.x = 8;

//Crea las luces de la escena
const lightColor = 0xffffff;

const ambientLight = new AmbientLight(lightColor, 0.5);
scene.add(ambientLight);

const directionalLight = new DirectionalLight(lightColor, 1);
directionalLight.position.set(0, 10, 0);
directionalLight.target.position.set(-5, 0, 0);
scene.add(directionalLight);
scene.add(directionalLight.target);

//Configura el renderizador, recuperando el lienzo del HTML
const threeCanvas = document.getElementById("three-canvas");
const renderer = new WebGLRenderer({ canvas: threeCanvas, alpha: true });
renderer.setSize(size.width, size.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

//Crea grillas y ejes en la escena
const grid = new GridHelper(50, 30);
scene.add(grid);

const axes = new AxesHelper();
axes.material.depthTest = false;
axes.renderOrder = 1;
scene.add(axes);

//Crea los controles de órbita (para navegar por la escena)
const controls = new OrbitControls(camera, threeCanvas);
controls.enableDamping = true;
controls.target.set(-2, 0, 0);

//Bucle de animación
const animate = () => {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
};

animate();

//Ajustar la ventana gráfica al tamaño del navegador
window.addEventListener("resize", () => {
  (size.width = window.innerWidth), (size.height = window.innerHeight);
  camera.aspect = size.width / size.height;
  camera.updateProjectionMatrix();
  renderer.setSize(size.width, size.height);
});

//Configura la carga IFC
const ifcLoader = new IFCLoader();
const ifcModels = [];
let input = document.getElementById("file-input");

input.addEventListener(
  "change",
  (changed) => {
    const ifcURL = URL.createObjectURL(changed.target.files[0]);
    console.log(input.files[0].name);
    $('#archivosCargados').append(input.files[0].name +"\n")
    ifcFileLocation = ifcURL;
    loadIFC(ifcURL);
    fetch(ifcURL)
      .then((response) => response.text())
      .then((data) => {
        LoadFileData(data);
      });
    function getIfcFile(url) {
      return new Promise((resolve, reject) => {
        var oReq = new XMLHttpRequest();
        oReq.responseType = "arraybuffer";
        oReq.addEventListener("load", () => {
          resolve(new Uint8Array(oReq.response));
        });
        oReq.open("GET", url);
        oReq.send();
      });
    }

    ifcapi.Init().then(() => {
      getIfcFile(ifcFileLocation).then((ifcData) => {
        modelID = ifcapi.OpenModel(ifcData);
        let isModelOpened = ifcapi.IsModelOpen(modelID);
        console.log({ isModelOpened });
        let allLines = getAll(modelID);
        let allIFCTypes = [];
        for (let index = 0; index < allLines.length; index++) {          
          allIFCTypes.push(allLines[index].type);
          
        }
        
        // console.log(allIFCTypes);
        // console.log(allLines[0]);
        // const manager = ifcLoader.ifcManager;
        // let types;
        // types.add(manager.getIfcType(modelID, allLines[0].expressID));
        // console.log( types );
        ifcapi.CloseModel(modelID);
      });
    });
  },
  false
);

// Sets up optimized picking
ifcLoader.ifcManager.setupThreeMeshBVH(
  computeBoundsTree,
  disposeBoundsTree,
  acceleratedRaycast
);

// List of categories names
// const categories = {
//   IFCWALLSTANDARDCASE,
//   IFCSLAB,
//   IFCFURNISHINGELEMENT,
//   IFCDOOR,
//   IFCWINDOW,
//   IFCPLATE,
//   IFCMEMBER,
// };

async function loadIFC(ifcURL) {
  await ifcLoader.ifcManager.setWasmPath("wasm/");
  ifcLoader.load(ifcURL, (ifcModel) => {
    ifcModels.push(ifcModel);
    scene.add(ifcModel);
  });
}

const raycaster = new Raycaster();
raycaster.firstHitOnly = true;
const mouse = new Vector2();

function cast(event) {
  // Computes the position of the mouse on the screen
  const bounds = threeCanvas.getBoundingClientRect();

  const x1 = event.clientX - bounds.left;
  const x2 = bounds.right - bounds.left;
  mouse.x = (x1 / x2) * 2 - 1;

  const y1 = event.clientY - bounds.top;
  const y2 = bounds.bottom - bounds.top;
  mouse.y = -(y1 / y2) * 2 + 1;

  // Places it on the camera pointing to the mouse
  raycaster.setFromCamera(mouse, camera);

  // Casts a ray
  return raycaster.intersectObjects(ifcModels);
}

async function pick(event) {
  const found = cast(event)[0];
  if (found) {
    const index = found.faceIndex;
    const geometry = found.object.geometry;
    const ifc = ifcLoader.ifcManager;
    const id = ifc.getExpressId(geometry, index);
    const modelID = found.object.modelID;
    const props = await ifc.getItemProperties(modelID, id);
    let json = JSON.stringify(props, null, 2);
    $("#message").html(json);
    console.log("ElementID: " + id);
    const manager = ifcLoader.ifcManager;
    const type = manager.getIfcType(modelID, id);
    console.log("tipoIFC: " + type);
  }
}
threeCanvas.onclick = pick;

// Creates subset material
const preselectMat = new MeshLambertMaterial({
  transparent: true,
  opacity: 0.6,
  color: 0xff88ff,
  depthTest: false,
});

const ifc = ifcLoader.ifcManager;

// Reference to the previous selection
let preselectModel = { id: -1 };

function highlight(event, material, model) {
  const found = cast(event)[0];
  if (found) {
    // Gets model ID
    model.id = found.object.modelID;

    // Gets Express ID
    const index = found.faceIndex;
    const geometry = found.object.geometry;
    const id = ifc.getExpressId(geometry, index);

    // Creates subset
    ifcLoader.ifcManager.createSubset({
      modelID: model.id,
      ids: [id],
      material: material,
      scene: scene,
      removePrevious: true,
    });
  } else {
    // Removes previous highlight
    ifc.removeSubset(model.id, material);
  }
}

window.onmousemove = (event) => highlight(event, preselectMat, preselectModel);

const selectMat = new MeshLambertMaterial({
  transparent: true,
  opacity: 0.6,
  color: 0xff00ff,
  depthTest: false,
});

const selectModel = { id: -1 };
window.onclick = (event) => highlight(event, selectMat, selectModel);

//-----------------------------MOSTRAR ESTRUCTURA IFC-----------------------------

const todo = document.getElementById("todo");

async function LoadFileData(ifcAsText) {
  todo.innerHTML = ifcAsText.replace(/(?:\r\n|\r|\n)/g, "<br>");
}

//-----------------------------MULTIREADING-----------------------------

async function setUpMultiThreading() {
  const manager = ifcLoader.ifcManager;
  // These paths depend on how you structure your project
  await manager.useWebWorkers(true, "IFCWorker.js");
  await manager.setWasmPath("wasm/");
}

setUpMultiThreading();

function setupProgressNotification() {
  const text = document.getElementById("progress-text");
  ifcLoader.ifcManager.setOnProgress((event) => {
    const percent = (event.loaded / event.total) * 100;
    const result = Math.trunc(percent);
    text.innerText = result.toString();
  });
}

setupProgressNotification();

//-----------------------------OBTENER IFCTYPES-----------------------------

function getAll(modelID) {
  let lines = ifcapi.GetAllLines(modelID);
  let lineSize = lines.size();
  let allLines = [];
  for (let i = 0; i < lineSize; i++) {
    // Obtiene el ElementoId de las lineas
    let relatedID = lines.get(i);
    // Obtiene el ElementData utilizando el relatedID
    let relDefProps = ifcapi.GetLine(modelID, relatedID);
    allLines.push(relDefProps);
  }
  return allLines;
}

//-----------------------------MOSTRAR/OCULTAR ELEMENTOS-----------------------------

// // Gets the name of a category
// function getName(category) {
// 	const names = Object.keys(categories);
// 	return names.find(name => categories[name] === category);
// }

// // Gets all the items of a category
// async function getAll(category) {
// 	return ifcLoader.ifcManager.getAllItemsOfType(0, category, false);
// }

// // Creates a new subset containing all elements of a category
// async function newSubsetOfType(category) {
// 	const ids = await getAll(category);
// 	return ifcLoader.ifcManager.createSubset({
// 		modelID: 0,
// 		scene,
// 		ids,
// 		removePrevious: true,
// 		customID: category.toString(),
// 	});
// }

// // Stores the created subsets
// const subsets = {};

// async function setupAllCategories() {
// 	const allCategories = Object.values(categories);
// 	for (let i = 0; i < allCategories.length; i++) {
// 		const category = allCategories[i];
// 		await setupCategory(category);
// 	}
// }

// // Creates a new subset and configures the checkbox
// async function setupCategory(category) {
// 	subsets[category] = await newSubsetOfType(category);
// 	setupCheckBox(category);
// }

// // Sets up the checkbox event to hide / show elements
// function setupCheckBox(category) {
// 	const name = getName(category);
// 	const checkBox = document.getElementById(name);
// 	checkBox.addEventListener('change', (event) => {
//     alert("Cambio");
// 		const checked = event.target.checked;
// 		const subset = subsets[category];
// 		if (checked) scene.add(subset);
// 		else subset.removeFromParent();
// 	});
// }

//-----------------------------EXTRAS-----------------------------

$("#button").click(() => {
  alert("Funciona!");
});
