// Renderer, orthographic camera and lights. Exposes one global: createScene
function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 100);

  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const sun = new THREE.DirectionalLight(0xffffff, 0.9);
  sun.position.set(3, 8, 5);
  scene.add(sun);

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const aspect = w / h;
    let viewH = 10;
    let viewW = viewH * aspect;
    if (aspect < 1) {
      viewW = 9;
      viewH = viewW / aspect;
    }
    camera.left = -viewW / 2;
    camera.right = viewW / 2;
    camera.top = viewH / 2;
    camera.bottom = -viewH / 2;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  window.addEventListener('resize', resize);
  resize();
  return { renderer, scene, camera };
}
